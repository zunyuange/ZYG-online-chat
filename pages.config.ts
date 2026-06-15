export default {
	projectName: 'online-chat',
	build: {
		command: 'npm run build',
		outputDir: 'dist'
	},
	dev: {
		port: 3010,
		local: true
	},
	routing: {
		'/api/*': 'functions/[[path]]',
		'/uploads/*': 'functions/[[path]]',
		'*': 'dist/*'
	}
};