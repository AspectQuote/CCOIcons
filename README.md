# CCO Icons Server
Currently, Cube Collector Online uses the DOM to render prefixes and animations. This comes with a slew of issues, mostly related to the PERFORMANCE of inventory items. At first this wasn't an issue, as prefixes used to just be simple little images with an animation or two tied to them. However, prefixes have grown larger and larger in scope, creating a couple of issues:
1. Client Performance (As mentioned earlier)
2. Some prefixes are inconsistent with how they apply to cubes
3. Server Performance (When creating many B-Side cubes)
4. Inconsistent art-style (Not common, but sometimes hard to enforce)

This icon generation server aims to fix that. The server will serve requests over HTTPS to get images for cubes with their prefixes AND their modifiers (B-Side, Divine, etc.) intact. This will also allow for icons for prefixes to be created (an image with only the prefix) for stuff like CCOStats to use for better UX. I will be updating this README with documentation as things get finished.