const esbuild = require("esbuild");

esbuild
	.build({
		entryPoints: ["./src/index.ts"],
		bundle: true,
		platform: "node",
		target: "es2020",
		outfile: "./dist/bundle.js",
		//   external: ['chalk'], // Exclude dependencies
		sourcemap: true,
	})
	.then(() => {
		console.log("js bundled successfully");
	})
	.catch((error) => {
		console.error("build failed: ", error);
		process.exit(1);
	});
