# running-map-example

An example of how to make a running map with open source components.

# [Annotated Documentation](https://www.mapbox.com/running-map-example/docs/)

This is pulled together using [browserify](http://browserify.org/):
the libraries it depends on are tracked in the [package.json](package.json)
file and pulled in with the [npm](https://www.npmjs.com/) utility.

The end result is a static site (despite being 'built' with node) that you
can host on [GitHub Pages](https://pages.github.com/) or any other host.

## Install

```sh
$ npm install
```

## Run For Development

This will dynamically recompile the project and serve it up at http://localhost:1337/

```sh
$ npm start
```

## Build for Production

```sh
$ npm run build
```
