const webpack = require('webpack');

module.exports = [
    {
        entry: './src/server/index.ts',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                }
            ]
        },
        // https://github.com/felixge/node-formidable/issues/337#issuecomment-153408479
        plugins: [
            new webpack.DefinePlugin({ 'global.GENTLY': false }),
        ],
        optimization: {
            minimize: true
        },
        resolve: {
            extensions: [ '.tsx', '.ts', '.js' ]
        },
        output: {
            filename: 'server.js',
            path: `${__dirname}/dist/`
        },
        target: 'node',
        mode: 'production',
    },
    {
        entry: './src/client/index.ts',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                }
            ]
        },
        // https://github.com/felixge/node-formidable/issues/337#issuecomment-153408479
        plugins: [
            new webpack.DefinePlugin({ 'global.GENTLY': false }),
        ],
        optimization: {
            minimize: true,
        },
        resolve: {
            extensions: [ '.tsx', '.ts', '.js' ]
        },
        output: {
            filename: 'client.js',
            path: `${__dirname}/dist/`
        },
        target: 'node',
        mode: 'production',
    }
];