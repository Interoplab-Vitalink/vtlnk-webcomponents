# vitalink_webcomponents
Vitalink webcomponents test page, based on https://www.npmjs.com/package/@smals-belgium-shared/vitalink-webcomponents

## Getting started
1. Clone the repository in a desired location:
  ```git clone git@github.com:gwenbleyen87/vitalink_webcomponents.git```.
2. Execute ```npm install```in terminal/command prompt.
3. Execute ```node server.js```.
4. In a webbrowser by choice, navigate to ```http://localhost:3001```to access the testing page.

## Docker container
1. Building image: 
```docker buildx build --platform linux/amd64 -t gwenbleyen/vitalink-webcomponents:amd64 --push .```

OR

```docker buildx build --platform linux/arm64 -t gwenbleyen/vitalink-webcomponents:arm64 --push .```
# vitalink-webcomponents
