var path = require('path');
var node_modules = path.resolve(__dirname, 'node_modules');

module.exports = {
    entry: {
        app: ['./src/app.js']
    },
    output: {
        path: "./public",
        filename: "app.js"
    },
    module: {
        loaders: [
            { test: /\.jsx?$/, exclude: /node_modules/, loader: "babel-loader" }
        ],
    },
    devServer: {
        contentBase: "./public"
    }
};