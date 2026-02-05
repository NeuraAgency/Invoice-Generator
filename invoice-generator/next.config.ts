const path = require("path");

const nextConfig = {
	eslint: {
		// Allow production builds to succeed even if there are ESLint errors
		ignoreDuringBuilds: true,
	},
	// Avoid Next.js picking an incorrect workspace root when multiple lockfiles exist
	outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
