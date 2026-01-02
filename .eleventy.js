const Image = require("@11ty/eleventy-img");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const path = require("path");
const fs = require("fs");

module.exports = function(eleventyConfig) {
  // Syntax highlighting for code blocks
  eleventyConfig.addPlugin(syntaxHighlight);

  // Passthrough copy for fonts and favicons
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy({ "src/icon32.png": "icon32.png" });
  eleventyConfig.addPassthroughCopy({ "src/icon64.png": "icon64.png" });
  eleventyConfig.addPassthroughCopy({ "src/og-image.png": "og-image.png" });

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

  // Passthrough copy for code assets (for local dev)
  eleventyConfig.addPassthroughCopy("src/assets/code");

  // Convert code/ links to GitHub (prod) or local (dev)
  eleventyConfig.addTransform("processCodeLinks", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) {
      return content;
    }

    const isProd = process.env.ELEVENTY_ENV === 'production';
    const siteData = require("./src/_data/site.js")();
    const githubBase = `${siteData.github}/blob/${siteData.githubBranch}/src/assets/code`;

    // Match <a href="code/...">...</a> links
    return content.replace(
      /<a\s+href="code\/([^"]+)"([^>]*)>([^<]*)<\/a>/gi,
      (_, filePath, attrs, linkText) => {
        if (isProd) {
          const githubUrl = `${githubBase}/${filePath}`;
          return `<a href="${githubUrl}"${attrs} target="_blank" rel="noopener">${linkText}</a>`;
        } else {
          return `<a href="/assets/code/${filePath}"${attrs} target="_blank">${linkText}</a>`;
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
        // Check if content is already wrapped in a div
        const trimmed = innerContent.trim();
        if (trimmed.startsWith('<div>') || trimmed.startsWith('<div ')) {
          return match; // Already wrapped
        }
        return `<details${detailsAttrs}><summary${summaryAttrs}>${summaryContent}</summary><div>${innerContent}</div></details>`;
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

    const files = fs.readdirSync(postsDir).filter(f => f.endsWith(".md") && !f.startsWith("_"));

    for (const file of files) {
      const slug = file.replace(".md", "");
      const srcPath = path.join(postsDir, file);
      const destDir = path.join(outputDir, slug);
      const destPath = path.join(destDir, "llms.txt");

      if (fs.existsSync(destDir)) {
        const content = fs.readFileSync(srcPath, "utf-8");
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
