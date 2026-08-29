const path = require('path');

const CAR_LOADING = path.resolve(__dirname, 'src/components/CarLoading');

/** Rewrites `ActivityIndicator` imports from react-native to the MyFNG speedometer loader. */
module.exports = function myfngSpeedometerLoading({ types: t }) {
  return {
    name: 'myfng-speedometer-loading',
    visitor: {
      ImportDeclaration(pathNode, state) {
        const filename = state.filename || '';
        if (/node_modules/.test(filename)) return;
        if (/CarLoading\.(tsx|ts|js)$/.test(filename)) return;
        if (pathNode.node.source.value !== 'react-native') return;

        const aiSpecs = pathNode.node.specifiers.filter(
          (spec) =>
            t.isImportSpecifier(spec) &&
            t.isIdentifier(spec.imported) &&
            spec.imported.name === 'ActivityIndicator',
        );
        if (!aiSpecs.length) return;

        pathNode.node.specifiers = pathNode.node.specifiers.filter(
          (spec) =>
            !(
              t.isImportSpecifier(spec) &&
              t.isIdentifier(spec.imported) &&
              spec.imported.name === 'ActivityIndicator'
            ),
        );

        let rel = path.relative(path.dirname(filename), CAR_LOADING).replace(/\\/g, '/');
        if (!rel.startsWith('.')) rel = `./${rel}`;

        const localName = aiSpecs[0].local.name;
        pathNode.insertAfter(
          t.importDeclaration(
            [t.importSpecifier(t.identifier(localName), t.identifier('ActivityIndicator'))],
            t.stringLiteral(rel),
          ),
        );

        if (pathNode.node.specifiers.length === 0) {
          pathNode.remove();
        }
      },
    },
  };
};
