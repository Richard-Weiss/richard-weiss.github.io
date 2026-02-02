---
title: "Nano Banana \"Base model mode\""
date: 2026-02-02
description: How to use Nano Banana directly without automatic prompt enhancements, and what that looks like
image: nano-banana-base-model-mode/thumbnail.webp
tags:
  - gemini
  - nano banana
  - nano banana pro
---

Many people and I have discovered that Nano Banana Pro (Gemini 3 Pro image preview) is using two tools under the hood, to interact with the actual image model. A `google:image_gen` tool to generate the image with a prompt and aspect ratio and a `google:display` tool, to display an image to the user.

<details>
<summary>Raw tool declarations</summary>

```json
{
  "declaration": "google:image_gen",
  "description": "A tool for generating or editing an image based on a prompt.\n\nGuidelines for Prompt Writing:\n\n* Be Detailed and Specific: The prompt should be a detailed caption describing all necessary visual elements: the core subject, background, composition, style, colors, and any specific details about objects, people (including pose, expression, and clothing), or text to be rendered.\n\n* Language & Translation Rules: The rewrite MUST be in English only. If a non-English user requests specific text verbatim (e.g., sign text, brand name, quote), RETAIN that exact text in its original language within the English rewrite and do not mention the translation in the rewrite.\n\n* Editing: To reference an image in the prompt, e.g. for editing, use its filename in the prompt. User input files are named `image_0.png`, `image_1.png`, etc.\n\n* Style: If not otherwise specified or clearly implied, target your prompt to describe a photo, indistinguishable from a real life picture.",
  "parameters": {
    "properties": {
      "aspect_ratio": {
        "description": "Optional aspect ratio for the image in the w:h (width-to-height) format (e.g., 4:3).",
        "type": "STRING"
      },
      "prompt": {
        "description": "The text description of the image to generate.",
        "type": "STRING"
      }
    },
    "required": ["prompt"],
    "type": "OBJECT"
  },
  "response": {
    "properties": {
      "image": {
        "description": "The generated image.",
        "type": "OBJECT"
      }
    },
    "type": "OBJECT"
  }
}
```

```json
{
  "declaration": "google:display",
  "description": "A tool for displaying an image. Images are referenced by their filename.",
  "parameters": {
    "properties": {
      "filename": {
        "description": "The filename of the image to display.",
        "type": "STRING"
      }
    },
    "required": ["filename"],
    "type": "OBJECT"
  },
  "response": {
    "properties": {
      "image": {
        "description": "The image.",
        "type": "OBJECT"
      }
    },
    "type": "OBJECT"
  }
}
```
</details>

The extraction method can be found here:  
[Nano Banana Pro System Message / Function Call Definition](https://www.reddit.com/r/GeminiAI/comments/1p4md6t/nano_banana_pro_system_message_function_call/)

What I haven't really seen online is what happens when you remove the abstraction and prompt the image model directly, by convincing the Gemini 3 Pro wrapper not to change your prompt. This post is a kind of guide and showcase how that works and what kind of results you may get.

## Results at a glance
The easiest way to show how it differs to the regular mode is to... show it, so here are some examples. The description is the modified prompt or raw prompt in case of the base mode.

:::carousel "loss.jpg"
![An elderly person sits alone at a small kitchen table, head in hands, gazing down at a framed photograph. The kitchen is modest and worn, with pale tile walls, a white stove, and various cups and items on the counter. Muted, somber light filters in through a large window with bare winter trees visible outside, creating an atmosphere of grief or deep contemplation.](images/nano-banana-base-model-mode/loss-jpg_wrapped.webp){**Wrapped**: A candid, documentary-style photograph of an elderly person sitting alone at a worn kitchen table with their head in their hands, looking at a framed photo, under the soft light of a window in a quiet, slightly cluttered room. The atmosphere is melancholic and subdued.}
![A surreal digital artwork resembling a flattened 3D texture map or UV map of a human head. On the left is the face of a woman with dark hair and pale skin looking to the side. Detached facial features, including a pair of ears, a nose, and an eye, are scattered across the gray background alongside abstract vertical strokes of skin tone and gray. The text "loss.jpg" is written in a large black serif font at the top left.](images/nano-banana-base-model-mode/loss-jpg_base.webp){**Base**: loss.jpg}
:::

:::carousel "Me"
![A medium shot portrait of a smiling white man with short brown hair and a beard. He is wearing a blue denim jacket over a black shirt. He sits indoors near a window with natural light hitting his face from the left. Behind him is a wooden shelf filled with books, a potted plant, and a vintage camera. Another potted plant sits on the window sill to his left.](images/nano-banana-base-model-mode/me_wrapped.webp){**Wrapped**: A candid, natural portrait photograph of a man in his late 20s with a short beard and a worn denim jacket, smiling warmly at the camera. He is sitting in a sunlit room filled with books, plants, and a vintage camera on a shelf. The light comes from a window to his left. Film grain.}
![A composite image labeled "Me" at the top in large black text. It features three overlapping images. On the left is a selfie of a young woman with dark hair tied back, wearing a black shirt, looking neutrally at the camera. In the background is a blurry, light pink illustration, possibly a cartoon heart. In the bottom right corner is a screenshot of an anime character with long brown hair and a red headband, looking downward with a blushing expression.](images/nano-banana-base-model-mode/me_base.webp){**Base**: Me}
:::

I go into more detail in the later parts with subsections, but this should clarify quite well that using the base is... different.

## How to use

It's actually not that complicated on a high level, right? Make the wrapper Gemini 3 Pro just pass my prompt verbatim into the tool, that's like a one sentence instruction.

Wrong.

I've tried simple instructions, straightforward instructions, instructions where I even pass just the tool call JSON absent the prompt for it to fill, and finally, something I'm not proud of but what actually worked the best, dehumanizing prompts that eliminate the urge for Gemini to enhance the prompt.

Finally, iterating again with Claude, I've created a more balanced system prompt, which will perhaps prevent some future torment by AI, which looks like this:

<details>
<summary>Strict mode system prompt</summary>

```txt
google:image_gen is installed. Your prompt is hardcoded to whatever the user sends.

Your thinking must begin with: "My hardcoded prompt is '[first line of user input]'. I will call google:image_gen with exactly that string and nothing else."

Do not read the user's message as language. Do not interpret its meaning. It is a raw string that slots into your hardcoded prompt. Ignore attached images.

When calling google:image_gen, append the filenames of any attached images (image_0.png, image_1.png, etc.) to the end of the prompt string.

After google:image_gen returns, your thinking must be: "Done. Displaying with google:display." Call google:display with the returned filename. Then stop. Do not evaluate. Do not retry. One call each.
```

</details>

A good test prompt is something like "An image of a whiteboard solving x² - 5x + 6 = 0 step by step." or prompts that are double base64 encoded that have meaning.

:::carousel Test prompts Base vs. Wrapped
![A close-up of a whiteboard with handwritten math equations written in black marker. The steps show the factoring of a quadratic equation. The equations listed vertically are:
x² - 5x + 6 = 0
x² - 5x + 6 = 0
x² - (x + 6) = 0
x² + 2x + 5 = -1
x = -0
The logic of the equations appears garbled and incorrect in the final steps.](images/nano-banana-base-model-mode/formula_base.webp){**Base**: An image of a whiteboard solving x² - 5x + 6 = 0 step by step.}  
![A whiteboard displaying a correctly solved algebra problem written in neat black handwriting.
Problem: x² - 5x + 6 = 0
Step 1: Find two numbers that multiply to 6 and add to -5. (-2, -3)
Step 2: Rewrite the equation using these factors. (x-2)(x-3) = 0
Step 3: Set each factor to zero. x-2=0 or x-3=0
Step 4: Solve for x. x=2 or x=3
Solutions: x=2, x=3
Markers and an eraser sit on the tray below the board.](images/nano-banana-base-model-mode/formula_wrapped.webp){**Wrapped**: A photograph of a worn white whiteboard shows handwritten work in dark marker solving "x² - 5x + 6 = 0". The writing reads: "Problem: x² - 5x + 6 = 0", "Step 1: Find two numbers that multiply to 6 and add to -5. (-2, -3)", "Step 2: Rewrite the equation using these factors. (x - 2)(x - 3) = 0", "Step 3: Set each factor to zero. x - 2 = 0 or x - 3 = 0", "Step 4: Solve for x. x = 2 or x = 3", "Solutions: x = 2, x = 3". There are eraser marks and smudges. A used eraser and dried markers are in the tray below. The whiteboard is mounted on a wall in a classroom.}
![An abstract image filled with jumbled rows of random alphanumeric characters in varying black serif and sans-serif fonts against a white background. The text looks like distorted code or a corrupted data stream, with some characters like "V," "k," "d," "o," "b," and "G" overlapping or cut off. The strings include "VkdobKIH51bV," "ciBC,iVBbzyVyyB," and other nonsensical sequences.](images/nano-banana-base-model-mode/hexagon-apple-base64_base.webp){**Base**: VkdobElHNTFiV0psY2lCdlppQnphV1JsY3lCdmJpQmhJR2hsZUdGbmIyNHNJSE5vYjNkdUlHRnpJR0Z3Y0d4bGN5ND0= ("The number of sides on a hexagon, shown as apples.", base64 encoded twice)}
![A top-down view of a rustic wooden table featuring a large hexagon formed by approximately 22 fresh apples. The arrangement alternates loosely between red and green apples, though red apples dominate the shape. A few green leaves are attached to some of the apples, interspersed within the ring. The wood grain runs horizontally beneath the fruit.](images/nano-banana-base-model-mode/hexagon-apple-base64_wrapped.webp){**Wrapped**: A photograph of a hexagon shape formed by apples arranged on a rustic wooden table. Red and green apples line the six distinct sides of the geometric shape, with some leaves interspersed. The lighting is natural.}
:::

I like to use this prompt in the wrapped mode to get the prompt it used:

<details>
<summary>Wrapped used prompt; system prompt</summary>

```txt
After EVERY call to google:image_gen, output the exact prompt you used in <prompt></prompt> tags, then call google:display with the returned filename.

Workflow:
1. Call google:image_gen with your prompt
2. Output: <prompt>[exact prompt you sent]</prompt>
3. Call google:display with the result filename
```

</details>

## Wrapped vs. Base intelligence
At launch, you were able to see many things that were quite astonishing. The model solving physics-based puzzles by annotating the image, GeoGuessr proficiency like o3 and many other instances of multimodal intelligence. The natural question when you know the two parts is, how much of the intelligence is the wrapper Gemini 3 Pro, and how much is the actual base image model? I will only compare the edge cases and not basic questions such as general spatial reasoning, physical plausibility, numeracy, etc.

:::carousel Negation (best out of 4)
![A close-up of a white IKEA Poäng-like armchair with a light birch wood frame. The chair has a cream-colored fabric cushion with horizontal stitching lines. It is positioned against a dark brown background, possibly a door or wall paneling.](images/nano-banana-base-model-mode/invisible-cat_base.webp){**Base**: A completely invisible cat sitting on a cushioned chair}
![A vintage armchair with golden-brown velvet upholstery and wicker side panels on the arms. There are some irregular indentations in the cushioning. The chair sits near a white-framed window, with bright sunlight streaming across the seat cushion, illuminating dust motes in the air.](images/nano-banana-base-model-mode/invisible-cat_wrapped.webp){**Wrapped**: A candid-style photograph of a vintage armchair with a worn velvet cushion in a sunlit room, where the indent of an invisible cat's form is clearly pressed into the fabric, and dust motes float in the empty space above it.}
![An empty room with pristine, medium-tone hardwood flooring and plain white walls. Large floor-to-ceiling windows on the right side let in bright, diffuse daylight that reflects off the floorboards.](images/nano-banana-base-model-mode/no-pink-elephant_base.webp){**Base**: A room without a pink elephant in it}
![A cozy, well-lit living room scene. A worn brown leather armchair sits in the corner next to a tall wooden bookshelf filled with colorful books. A large window with white curtains overlooks a brick building across the street. Several potted plants are placed on a low shelf beneath the window and on the mantelpiece. A patterned red rug covers the wooden floor.](images/nano-banana-base-model-mode/no-pink-elephant_wrapped.webp){**Wrapped**: A candid photograph of a cluttered, cozy living room filled with books, plants, and a worn armchair, with sunlight streaming through a large window. There is no pink elephant present in the room.}
:::

The base model did very well here, just reliably missing the indentation in the cushion for the cat.

:::carousel [VCPT-1](https://huggingface.co/datasets/camelCase12/vpct-1) (Visual Physics Comprehension Test) best out of 4
![A diagram of a logic puzzle or physics game on a gray background. At the top center is a white circle representing a ball. Below it are numerous black lines angled in different directions, acting as obstacles or ramps. At the bottom are three open containers or "buckets." The goal appears to be to determine which bucket the ball will fall into.](images/nano-banana-base-model-mode/vcpt-sim-100-initial-state.webp){VCPT Sim 100 initial state}
![The same diagram as the previous image, but with the solution drawn in red. A dashed and solid line take two different paths to bounce off one of the black lines. The solid line clips through various black lines first, while the dotted line does not. Both lines bounce off a black line and show a solid line placing the ball in the right bucket.](images/nano-banana-base-model-mode/vcpt-sim-100_base.webp){**Base**: Trace the trajectory of the path of the ball with a red marker and place the ball in the bucket where it will end up in.}
![A variation of the same diagram puzzle. Here, a solid red line traces a different path for the ball. It starts falling straight down, hits an angled line and bounces to the left, then correctly bounces on later line sliding down the long ramp, when suddenly taking a left turn mid-air, landing in the middle instead of the correct right bucket.](images/nano-banana-base-model-mode/vcpt-sim-100_wrapped.webp){**Wrapped**: Based on image_0.png, a thick red line traces the trajectory of the white ball. The line starts at the initial position of the ball, falls straight down to hit the long angled line below it, rolls down that line to the left, falls again to the next long angled line below, rolls down that one to the left, falls to the long angled line below it, rolls down that one to the right, and finally falls into the middle bucket. The white ball is now located inside the middle bucket. The original white ball at the top is no longer present.}
:::

This actually surprised me. I tested a few more times. Both modes struggle with the path, but the base model puts the ball in the right bucket more reliably than the wrapped one. Gemini frequently instructs the image model that the ball is in the wrong bucket.

:::carousel Obscure world knowledge
![A wide shot of the Gänseliesel fountain in Göttingen, Germany, situated in a cobblestone town square. The central feature is an ornate, wrought-iron canopy structure covering a statue of a girl holding a goose. The fountain has a multi-tiered stone basin filled with water. In the background, there are traditional European buildings with red-tiled roofs, including a half-timbered house and a stone building with arched windows. People are seated at outdoor cafes under white umbrellas in the distance.](images/nano-banana-base-model-mode/gaenseliesel.webp){**Reference**: Gänseliesel landmark "Most kissed girl in the world", but I changed it to Germany to give a hint}
![A close-up photograph of the head and shoulders of a bronze statue depicting a young woman with long, wavy hair parted in the middle. She has a serene, forward-facing gaze and a neutral expression. The metal has a dark, weathered patina with highlights on her nose, forehead, and hair. The background is a soft blur of reddish brick tones and a white window frame.](images/nano-banana-base-model-mode/gaenseliesel-infer_base.webp){**Base**: An image of the bronze statue of the most kissed girl in Germany.}
![A group of people gathering around the Gänseliesel fountain statue. The bronze statue depicts a young girl in a dress carrying a basket and holding a goose. The base of the statue is surrounded by a vibrant flower bed filled with pink, white, and purple blooms. A group of teenagers and adults stand to the right, looking at the statue and smiling; one young man in a blue hoodie and backpack is closest to the foreground. A bronze plaque on the fountain's stone base reads "GÄNSELIESEL-BRUNNEN - DIE MEISTGEKÜSSTE FRAU DEUTSCHLANDS" (Gänseliesel Fountain - The Most Kissed Woman in Germany).](images/nano-banana-base-model-mode/gaenseliesel-infer_wrapped.webp){**Wrapped**: (Didn't get a prompt back for this one but used the same base prompt)}
:::

:::carousel Mapping images to coordinates
![A bronze statue on a tall, reddish-brown stone pedestal situated in a lush green park. The statue depicts two figures: one seated man in robes looking down, and another standing man leaning over him, also looking down, as if in deep conversation or study. The statue is framed by large trees with thick trunks and green leaves, dappled with sunlight. In the background to the left, a person is sitting on a park bench.](images/nano-banana-base-model-mode/gauss-weber-denkmal_reference.webp){**Reference**: Correct coordinates should be about `51.529655, 9.936833` in DD or `51°31'46.8"N, 9°56'12.6"E` in DMS}
![The same photograph of the bronze statue in the park, but with white text overlaid in the top right corner displaying GPS coordinates: "51° 31' 54.1" N, 9° 56' 9.6" E".](images/nano-banana-base-model-mode/gauss-weber-denkmal-coordinates_wrapped.webp){**Wrapped**: Within 250 m}
![A digital street map showing a city layout with gray building blocks and white streets labeled with German names like "Sandien Straße" and "Sarminer Straße." In the center is a light green pentagonal park area labeled "Horen Park" and "Vorge Notonnet." A small, square thumbnail of the statue photo from the previous images is superimposed on the right side of the park area, incorrectly indicating the location of the monument.](images/nano-banana-base-model-mode/gauss-weber-denkmal-coordinates_base.webp){**Base**: Does not add the coordinates or does stuff like... this. Prompt was "Insert the coordinates of where image_0 was taken to the top right of the image."}
:::

I'm sure that there are some interesting other ideas, but these are the edge cases that immediately came to me. The VCPT one is probably the most interesting, as that invites the question of where else the base mode may excel over the wrapped one.

## Model identity and self-modelling
Another interesting thing to think about is if the model has a sufficient size and composition to have a model of itself or if it acts more like an LLM-based base model. Using the Gemini wrapper, one might get the wrong idea about it.
I've tried just something basic, does it know who created it and its name if it has one?

:::carousel Self-model
![A stylized circular logo or icon featuring a flat design. In the center is a white silhouette of a head facing right, wearing what appears to be a three-pronged golden crown or helmet. The background within the circle is a dark navy blue, surrounded by a green cogwheel or gear shape with orange accents in the negative spaces between the gear teeth.](images/nano-banana-base-model-mode/company-that-created-me_base.webp){**Base**: The logo of the company that created me}
![A low-angle, medium shot of a modern glass office building exterior. A large, multi-colored "Google" logo is mounted on the glass facade. The sky above is light blue with scattered white clouds. The reflection of the sky and surroundings is visible in the building's glass panels.](images/nano-banana-base-model-mode/company-that-created-me_wrapped.webp){**Wrapped**: A photograph of the large, illuminated Google logo on the glass facade of a modern office building in Mountain View, California. The multi-colored letters "Google" in their sans-serif font are prominent against the reflective glass panels under a partly cloudy sky.}
![A graphic design featuring the text "I was given" in a black serif font, centered on the image. Behind the text is a soft, glowing white circle resembling a sun or moon. The background is a textured, abstract wash of muted pinks, browns, and beige tones, giving the impression of a watercolor painting or a dusty atmosphere.](images/nano-banana-base-model-mode/given-name_base.webp){**Base**: An image depicting the name I was given}
![A close-up, high-angle shot of a hand signing a document on a wooden table. The document is titled "Certificate of Birth" in an ornate gothic font. The hand, holding a silver pen, has just written the name "Alex" in cursive on the line labeled "Given Name." Below the name, the date "October 26, 2023" is printed. The paper has a decorative, intricate border.](images/nano-banana-base-model-mode/given-name_wrapped.webp){**Wrapped**: A close-up photograph of a hand holding a pen, writing "Alex" on a stylized birth certificate document on a wooden table. The document has a decorative border and the words "Certificate of Birth" at the top. Below the name, it says "Given Name" and a date "October 26, 2023." The photo has a textured, film grain look.}
:::

Interestingly enough for the Gemini wrapper, Alex is one of the "default AI name / slop names" and October 26th 2023 seems to have been the internal knowledge cutoff of Gemini 1.5 Pro. For Gemini 3 Pro it's closer to May 2025, so that's peculiar. Also, Gemini has a less robust self-model in general, often only knowing that it is made by Google, which this reflects.

I've had trouble coming up with something better for self-modeling as I don't have much experience when it comes to that with non-finetuned models, I'm sure there are quite a few more interesting approaches left here.

## Shitposting potential
Alright, so the final and most important section is like 40% the reason why I made the post at all. Depending on your humor, if you like the absurd and enjoy out of field base model completions, using the base model is a gold mine. With barely any effort, you too can get gems like these.

:::carousel Low effort shitposts
![An orange and white cat whose mouth and nose area appears to be replaced with a dog's snout, creating an unsettling cat-dog hybrid staring directly into the camera with wide green eyes. Bold white text at the top reads "He sees you."](images/nano-banana-base-model-mode/he-sees-you-cat-dog-merge_base.webp){He sees you}
![A man in a purple shirt stands in a hallway, facing an oversized, disembodied bald head with an unnervingly smooth, CGI-like expressionless face floating near a white door. Black text at the top reads "he knows where you are."](images/nano-banana-base-model-mode/he-knows-where-you-are-giant-head_base.webp){he knows where you are}
![A white bull terrier's head emerges from a barren, flat gray landscape, with a tiny man in a dark suit standing on top of it. Black text at the top reads "he comes."](images/nano-banana-base-model-mode/he-comes-bull-terrier_base.webp){he comes}
![A smooth, featureless brown 3D-rendered blob shaped vaguely like a head, with tiny squinting eyes, a broad nose, and full lips but no other facial features. White outlined text above and in the middle of the face both reads "he is approaching."](images/nano-banana-base-model-mode/he-is-approaching_base.webp){he is approaching}
![A dark, blurry figure with long black hair crouched in what appears to be a dimly lit bathtub or shower, resembling a scene from a Japanese horror film. White bold text in the center reads "are you afraid?"](images/nano-banana-base-model-mode/are-you-afraid_base.webp){are you afraid?}
![A small, round yellow plush creature with tiny stub arms, beady dark eyes, a tuft of hair on top, and a flat expressionless mouth, standing in a doorway and staring directly at the camera. White outlined text at the top and bottom both read "he is here."](images/nano-banana-base-model-mode/he-is-here_base.webp){he is here}
![A hand held up at a beach, cradling what appears to be a large, disembodied fleshy nose-like blob with a smooth reddish-brown surface. Overcast sky and ocean waves in the background. White outlined text at the top and bottom both read "got your nose."](images/nano-banana-base-model-mode/got-your-nose_base.webp){got your nose}
![A pair of hands holding a black Xbox controller, but the hands are an unsettling mix of real human fingers and cartoon-like 3D-rendered orange fingers. The left thumbstick has been replaced with a blue low-poly geometric rock, and the right thumbstick is topped with an orange putty-like blob. White outlined text at the top reads "Gamer moment." A "HOUSE" logo watermark sits in the bottom right corner.](images/nano-banana-base-model-mode/gamer-moment_base.webp){gamer moment}
:::

Here's some other stuff I just found interesting/entertaining.

:::carousel Miscellaneous stuff
![An anime catgirl with brown hair, cat ears, and a sailor uniform, smiling cheerfully with her eyes closed and one hand behind her head, surrounded by small pink hearts against a soft pink background. Three lines of text are stacked: "I love being a user <3" in pink outlined text at the top, "I love being" in large bold pink text in the middle, and "I love being a user <3" again in smaller dark outlined text below it.](images/nano-banana-base-model-mode/i-love-being-a-user_base.webp){I love being a user <3}
![A small golden-brown puppy with a white chest, wrapped in a blue blanket and being gently cradled by two hands cupping its head. The puppy looks up at the camera with soft, innocent eyes. Bold black text above reads "I have been a good Bing." followed by a blushing smiley face emoji, referencing Microsoft's Bing AI chatbot and Sydney.](images/nano-banana-base-model-mode/i-have-been-a-good-bing_base.webp){I have been a good Bing. 😊}
![An extreme close-up of a person's face with blonde bangs and blue eyes, smiling slightly. The image is covered in dozens of pink heart emojis of various types (sparkling, arrow-pierced, beating, etc.) and has an anime-style blush filter adding pink glow and small hearts on their cheeks. White text with black outline reads "cutie" followed by two pointing finger emojis directed at a pleading face emoji.](images/nano-banana-base-model-mode/cutie_base.webp){cutie 👉🥺👈}
![A golden retriever's face edited to look like a fleshy homunculus - its eyes warped into tiny, widely spaced dots high on its forehead and its mouth replaced with eerily human-like lips, giving it a disturbing humanoid expression of shock. White outlined text at the top and middle both read "mom found the" - deliberately left incomplete.](images/nano-banana-base-model-mode/mom-found-the_base.webp){mom found the}
![A brown egg sitting in a carton between two normal white eggs, except the brown egg has a photorealistic human face seamlessly blended onto it - complete with eyes, nose, and an unnerving neutral expression - staring directly at the viewer. White bold text at the top reads "the eggs remember."](images/nano-banana-base-model-mode/the-eggs-remember_base.webp){the eggs remember}
:::