const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({ jwksUri: 'https://appleid.apple.com/auth/keys' });

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyAppleToken(identityToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      identityToken,
      getKey,
      { algorithms: ['RS256'], issuer: 'https://appleid.apple.com', audience: process.env.APPLE_BUNDLE_ID },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

module.exports = { verifyAppleToken };