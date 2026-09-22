# vitalink_webcomponents
Vitalink webcomponents test page, based on https://www.npmjs.com/package/@smals-belgium-shared/vitalink-webcomponents

## Getting started
1. Clone the repository in a desired location:
  ```git clone git@github.com:gwenbleyen87/vitalink_webcomponents.git```.
2. Execute ```npm install```in terminal/command prompt.
3. Execute ```npm start``` (or ```node server.js```).
4. In a webbrowser by choice, navigate to ```http://localhost:3001```to access the testing page.

Do not open `index.html` as a file (`file://…`). Serve it over HTTP (GitHub Pages,
`npm start`, or Docker).

The landing page version check runs **fully in the browser** (no server API required):
it reads the declared version from `package.json` and compares it with the latest
release on the public npm registry. That works on GitHub Pages without `npm install`.

Optional local server: `npm start` still provides `/api/package-version` for debugging.

## Docker container
1. Building image: 
```docker buildx build --platform linux/amd64 -t gwenbleyen/vitalink-webcomponents:amd64 --push .```

OR

```docker buildx build --platform linux/arm64 -t gwenbleyen/vitalink-webcomponents:arm64 --push .```
# CORS and response bodies
The request log modal can only show response bodies if the browser is allowed to read them.
If the API does not include proper CORS headers, the browser blocks script access to the
body even though DevTools can still display it.

Recommended solutions:
- Configure the API to include CORS headers for your origin.
- Use a same-origin proxy during development.

Dev-only workaround (unsafe):
```open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome-cors"```

# vitalink-webcomponents
