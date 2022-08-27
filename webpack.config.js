module.exports = {
  devtool: 'source-map',
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    // "@blueprintjs/core": "Blueprint.Core"
  },
  externalsType: 'window',
  entry: './src/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'extension.js',
    path: __dirname,
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
};
