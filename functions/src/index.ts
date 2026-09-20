{
  "name": "qr-grading-functions",
  "version": "1.0.0",
  "private": true,
  "main": "lib/index.js",
  "engines": {
    "node": "20"
  },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "npm run build && firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "dependencies": {
    "@google-cloud/vision": "^5.3.2",
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0",
    "jsqr": "^1.4.0",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "@types/jsqr": "^1.4.6",
    "@types/node": "^22.10.2",
    "firebase-functions-test": "^3.4.1",
    "typescript": "^5.7.2"
  }
}
