module.exports = function (api) {
  api.cache(true);

  const isProduction = process.env.BABEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  return {
    presets: ['babel-preset-expo'],
    plugins: isProduction
      ? [
          [
            'transform-remove-console',
            // Keep console.error and console.warn so real errors are still surfaced
            // in production crash reporters; strip only noisy logs.
            { exclude: ['error', 'warn'] },
          ],
        ]
      : [],
  };
};
