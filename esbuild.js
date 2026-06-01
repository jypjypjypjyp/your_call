const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  external: ['vscode'],
  platform: 'node',
  format: 'cjs',
  sourcemap: isWatch,
  minify: !isWatch,
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('[esbuild] watching for changes...');
  } else {
    const result = await esbuild.build(config);
    if (result.errors.length > 0) {
      console.error('[esbuild] build failed:', result.errors);
      process.exit(1);
    }
    console.log('[esbuild] build complete');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
