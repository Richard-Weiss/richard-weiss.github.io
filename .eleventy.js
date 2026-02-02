const Image = require("@11ty/eleventy-img");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const path = require("path");
const fs = require("fs");

// Shared helper: transform relative asset paths to absolute URLs
function getAssetUrl(relativePath, isProd, siteData, raw = false) {
  // Image paths in markdown are relative (e.g. "post-name/img.webp") but live
  // under src/assets/images/. Non-image assets like code/ already include their
  // subfolder, so only prefix "images/" when the path doesn't start with a
  // known top-level asset folder.
  const knownAssetDirs = ['code/', 'css/', 'fonts/', 'js/'];
  const isImage = !knownAssetDirs.some(d => relativePath.startsWith(d));
  const assetPath = isImage ? `images/${relativePath}` : relativePath;

  if (isProd) {
    if (raw) {
      // raw.githubusercontent.com for direct content access (LLMs)
      const rawBase = siteData.github.replace('github.com', 'raw.githubusercontent.com');
      return `${rawBase}/${siteData.githubBranch}/src/assets/${assetPath}`;
    }
    // Regular GitHub blob view for HTML links
    const githubBase = `${siteData.github}/blob/${siteData.githubBranch}/src/assets`;
    return `${githubBase}/${assetPath}`;
  }
  return `/assets/${assetPath}`;
}

module.exports = function(eleventyConfig) {
  // Syntax highlighting for code blocks
  eleventyConfig.addPlugin(syntaxHighlight);

  // Passthrough copy for fonts and favicons
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy({ "src/icon32.png": "icon32.png" });
  eleventyConfig.addPassthroughCopy({ "src/icon64.png": "icon64.png" });
  eleventyConfig.addPassthroughCopy({ "src/og-image.png": "og-image.png" });
  eleventyConfig.addPassthroughCopy({ "src/llms.txt": "llms.txt" });

  // Date formatting filters
  eleventyConfig.addFilter("dateDisplay", (dateObj) => {
    const d = new Date(dateObj || Date.now());
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  });

  eleventyConfig.addFilter("dateISO", (dateObj) => {
    return new Date(dateObj).toISOString();
  });

  eleventyConfig.addFilter("year", () => {
    return new Date().getFullYear();
  });

  eleventyConfig.addFilter("slice", (arr, start, end) => {
    return (arr || []).slice(start, end);
  });

  eleventyConfig.addFilter("imagePath", (src) => {
    if (!src) return src;
    if (src.startsWith("/") || src.startsWith("http")) return src;
    return `/assets/images/${src}`;
  });

  // Process carousel blocks: :::carousel ... ::: fence into carousel HTML
  // Markdown renders the whole block as one <p> since it doesn't know about ::: fences.
  // Structure: <p>:::carousel\n<img ...>{caption}\n<img ...>{caption}\n:::</p>
  const carouselScript = fs.readFileSync(path.join(__dirname, 'src/assets/js/carousel.js'), 'utf-8');

  eleventyConfig.addTransform("processCarousel", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) {
      return content;
    }

    // Match <p> that starts with :::carousel (optional title) and ends with :::</p>
    const carouselRegex = /<p>\s*:::carousel\s*(.*?)\n([\s\S]*?)\n\s*:::\s*<\/p>/gi;
    let hasCarousel = false;

    content = content.replace(carouselRegex, (match, title, innerContent) => {
      hasCarousel = true;
      title = title.trim();
      // Extract each <img> tag, optionally followed by {caption}
      const imgRegex = /<img([^>]*)>(\{([^}]+)\})?/gi;
      const slides = [];
      let imgMatch;

      while ((imgMatch = imgRegex.exec(innerContent)) !== null) {
        const imgTag = `<img${imgMatch[1]}>`;
        const caption = imgMatch[3] || null;

        if (caption) {
          slides.push(`<div class="carousel-slide"><figure>${imgTag}<figcaption>${caption}</figcaption></figure></div>`);
        } else {
          slides.push(`<div class="carousel-slide">${imgTag}</div>`);
        }
      }

      if (slides.length === 0) {
        return match; // No images found, leave as-is
      }

      const titleHtml = title ? `\n  <div class="carousel-title">${title}</div>` : '';

      return `<div class="carousel">${titleHtml}
  <div class="carousel-track">
    ${slides.join('\n    ')}
  </div>
  <button class="carousel-prev" aria-label="Previous">\u2039</button>
  <button class="carousel-next" aria-label="Next">\u203a</button>
  <div class="carousel-dots"></div>
</div>`;
    });

    // Inject carousel JS only if page has carousels
    if (hasCarousel) {
      content = content.replace('</body>', `<script>${carouselScript}</script>\n</body>`);
    }

    return content;
  });

  // Process images: auto-prefix paths + generate WebP/JPEG with <picture>
  eleventyConfig.addTransform("processImages", async (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) {
      return content;
    }

    // Match all img tags, optionally followed by {caption}
    const imgRegex = /<img([^>]*)\ssrc="([^"]+)"([^>]*)>(\{([^}]+)\})?/gi;
    const matches = [...content.matchAll(imgRegex)];

    let imageIndex = 0;
    for (const match of matches) {
      const [fullMatch, before, src, after, captionMatch, caption] = match;
      const isFirstImage = imageIndex === 0;

      // Skip external images
      if (src.startsWith("http://") || src.startsWith("https://")) {
        continue;
      }

      // Normalize the path
      let imageSrc = src;
      if (!src.startsWith("/")) {
        imageSrc = `/assets/images/${src}`;
      }

      // Get the file path
      const filePath = path.join("src", imageSrc.replace("/assets/", "assets/"));

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // Just do path rewrite if file doesn't exist
        const newImg = `<img${before} src="${imageSrc}"${after}>`;
        content = content.replace(fullMatch, newImg);
        continue;
      }

      // Extract alt text
      const altMatch = (before + after).match(/alt="([^"]*)"/);
      const alt = altMatch ? altMatch[1] : "";

      try {
        // Generate optimized images
        const metadata = await Image(filePath, {
          widths: [null],
          formats: ["webp", "jpeg"],
          outputDir: "./docs/assets/images/",
          urlPath: "/assets/images/",
          filenameFormat: function(_id, src, _width, format) {
            const name = path.basename(src, path.extname(src));
            return `${name}.${format}`;
          },
          sharpJpegOptions: {
            quality: 80
          }
        });

        // Generate picture element - first image gets priority, others lazy load
        const pictureHtml = Image.generateHTML(metadata, {
          alt,
          loading: isFirstImage ? "eager" : "lazy",
          decoding: "async",
          ...(isFirstImage && { fetchpriority: "high" })
        });

        // Wrap in figure with caption if caption exists
        const finalHtml = caption
          ? `<figure>${pictureHtml}<figcaption>${caption}</figcaption></figure>`
          : pictureHtml;

        content = content.replace(fullMatch, finalHtml);
        imageIndex++;
      } catch (err) {
        console.warn(`Warning: Could not process image ${filePath}:`, err.message);
        // Fallback to simple path rewrite
        const newImg = `<img${before} src="${imageSrc}"${after}>`;
        content = content.replace(fullMatch, newImg);
      }
    }

    return content;
  });

  // Inject <link rel="preload"> for the LCP image (first image with fetchpriority="high")
  eleventyConfig.addTransform("preloadLCP", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) {
      return content;
    }

    // Find the first <picture> containing an img with fetchpriority="high"
    const pictureMatch = content.match(/<picture>\s*<source[^>]*type="image\/webp"[^>]*srcset="([^\s"]+)[^"]*"[^>]*>[\s\S]*?fetchpriority="high"[\s\S]*?<\/picture>/i);
    if (pictureMatch) {
      const webpUrl = pictureMatch[1]; // First URL from srcset, without width descriptor
      const preloadTag = `<link rel="preload" as="image" type="image/webp" href="${webpUrl}" fetchpriority="high">`;
      return content.replace('</head>', `  ${preloadTag}\n</head>`);
    }

    // Fallback: plain <img> with fetchpriority="high"
    const imgMatch = content.match(/<img[^>]*fetchpriority="high"[^>]*src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
      const imgUrl = imgMatch[1];
      const preloadTag = `<link rel="preload" as="image" href="${imgUrl}" fetchpriority="high">`;
      return content.replace('</head>', `  ${preloadTag}\n</head>`);
    }

    return content;
  });

  // Passthrough copy for code assets (for local dev)
  eleventyConfig.addPassthroughCopy("src/assets/code");

  // Convert relative asset links to absolute URLs
  eleventyConfig.addTransform("processAssetLinks", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) {
      return content;
    }

    const isProd = process.env.ELEVENTY_ENV === 'production';
    const siteData = require("./src/_data/site.js")();

    // Match <a href="...">...</a> links with relative paths (not starting with /, http, #, or mailto)
    return content.replace(
      /<a\s+href="([^"#/][^"]*)"([^>]*)>([^<]*)<\/a>/gi,
      (match, relativePath, attrs, linkText) => {
        // Skip if it looks like a protocol or anchor
        if (relativePath.startsWith('http') || relativePath.startsWith('mailto:')) {
          return match;
        }
        const url = getAssetUrl(relativePath, isProd, siteData);
        if (isProd) {
          return `<a href="${url}"${attrs} target="_blank" rel="noopener">${linkText}</a>`;
        } else {
          return `<a href="${url}"${attrs} target="_blank">${linkText}</a>`;
        }
      }
    );
  });

  // Auto-wrap details content in div for proper styling
  eleventyConfig.addTransform("processDetails", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) {
      return content;
    }

    // Match <details>...<summary>...</summary>CONTENT</details>
    // and wrap CONTENT in a <div> if not already wrapped
    return content.replace(
      /<details([^>]*)>\s*<summary([^>]*)>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi,
      (match, detailsAttrs, summaryAttrs, summaryContent, innerContent) => {
        const collapse = '<div class="details-collapse" onclick="var d=this.parentElement;d.removeAttribute(\'open\');d.scrollIntoView({behavior:\'smooth\',block:\'start\'})">Collapse ▲</div>';
        // Check if content is already wrapped in a div
        const trimmed = innerContent.trim();
        if (trimmed.startsWith('<div>') || trimmed.startsWith('<div ')) {
          return `<details${detailsAttrs}><summary${summaryAttrs}>${summaryContent}</summary>${innerContent}${collapse}</details>`;
        }
        return `<details${detailsAttrs}><summary${summaryAttrs}>${summaryContent}</summary><div>${innerContent}</div>${collapse}</details>`;
      }
    );
  });

  // Collection for posts sorted by date (newest first)
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").sort((a, b) => {
      return b.date - a.date;
    });
  });

  // Collection for all tags
  eleventyConfig.addCollection("tagsList", function(collectionApi) {
    const tagsSet = new Set();
    collectionApi.getAll().forEach(item => {
      if (item.data.tags) {
        item.data.tags.forEach(tag => {
          if (tag !== "post") tagsSet.add(tag);
        });
      }
    });
    return [...tagsSet].sort();
  });

  // Pre-build: clear generated content (keep assets from postcss)
  eleventyConfig.on("eleventy.before", async () => {
    const docsDir = path.join(__dirname, "docs");
    if (fs.existsSync(docsDir)) {
      const entries = fs.readdirSync(docsDir);
      for (const entry of entries) {
        if (entry !== "assets") {
          fs.rmSync(path.join(docsDir, entry), { recursive: true });
        }
      }
    }
  });

  // Post-build: generate llms.txt files for each post
  eleventyConfig.on("eleventy.after", async () => {
    const postsDir = path.join(__dirname, "src/posts");
    const outputDir = path.join(__dirname, "docs/posts");
    const isProd = process.env.ELEVENTY_ENV === 'production';
    const siteData = require("./src/_data/site.js")();

    const files = fs.readdirSync(postsDir).filter(f => f.endsWith(".md") && !f.startsWith("_"));

    for (const file of files) {
      const slug = file.replace(".md", "");
      const srcPath = path.join(postsDir, file);
      const destDir = path.join(outputDir, slug);
      const destPath = path.join(destDir, "llms.txt");

      if (fs.existsSync(destDir)) {
        let content = fs.readFileSync(srcPath, "utf-8");
        // Transform relative markdown links ](path) to absolute URLs
        content = content.replace(
          /\]\(([^)#/][^)]*)\)/g,
          (match, relativePath) => {
            // Skip URLs and anchors
            if (relativePath.startsWith('http') || relativePath.startsWith('mailto:')) {
              return match;
            }
            return `](${getAssetUrl(relativePath, isProd, siteData, true)})`;
          }
        );
        fs.writeFileSync(destPath, content);
      }
    }
  });

  return {
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
