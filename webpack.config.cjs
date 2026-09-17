const { sources } = require('webpack');

class EmitCommonJsPackagePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap(
      EmitCommonJsPackagePlugin.name,
      (compilation) => {
        compilation.emitAsset(
          'package.json',
          new sources.RawSource('{"type":"commonjs"}\n'),
        );
      },
    );
  }
}

module.exports = (options) => ({
  ...options,
  plugins: [...(options.plugins ?? []), new EmitCommonJsPackagePlugin()],
  resolve: {
    ...options.resolve,
    extensionAlias: {
      ...(options.resolve?.extensionAlias ?? {}),
      '.js': ['.ts', '.js'],
    },
  },
});
