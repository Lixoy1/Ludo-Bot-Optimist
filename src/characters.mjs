export const CHARACTERS=Object.freeze([
  {
    "id": "optimist",
    "src": "/assets/characters/optimist.webp",
    "width": 453,
    "height": 507,
    "aspectRatio": 0.89349
  },
  {
    "id": "lilya-detective",
    "src": "/assets/characters/lilya-detective.webp",
    "width": 484,
    "height": 508,
    "aspectRatio": 0.95276
  },
  {
    "id": "natalie",
    "src": "/assets/characters/natalie.webp",
    "width": 493,
    "height": 508,
    "aspectRatio": 0.97047
  },
  {
    "id": "nikita",
    "src": "/assets/characters/nikita.webp",
    "width": 499,
    "height": 508,
    "aspectRatio": 0.98228
  },
  {
    "id": "poison",
    "src": "/assets/characters/poison.webp",
    "width": 423,
    "height": 508,
    "aspectRatio": 0.83268
  },
  {
    "id": "lena",
    "src": "/assets/characters/lena.webp",
    "width": 475,
    "height": 507,
    "aspectRatio": 0.93688
  },
  {
    "id": "elvina",
    "src": "/assets/characters/elvina.webp",
    "width": 446,
    "height": 507,
    "aspectRatio": 0.87968
  },
  {
    "id": "ksyusha",
    "src": "/assets/characters/ksyusha.webp",
    "width": 491,
    "height": 507,
    "aspectRatio": 0.96844
  },
  {
    "id": "cat",
    "src": "/assets/characters/cat.webp",
    "width": 361,
    "height": 508,
    "aspectRatio": 0.71063
  },
  {
    "id": "owl",
    "src": "/assets/characters/owl.webp",
    "width": 344,
    "height": 508,
    "aspectRatio": 0.67717
  },
  {
    "id": "husky",
    "src": "/assets/characters/husky.webp",
    "width": 361,
    "height": 508,
    "aspectRatio": 0.71063
  },
  {
    "id": "raccoon",
    "src": "/assets/characters/raccoon.webp",
    "width": 353,
    "height": 508,
    "aspectRatio": 0.69488
  }
]);
export function getCharacter(id){const c=CHARACTERS.find(x=>x.id===id);if(!c)throw new RangeError("Unknown character: "+id);return c;}
