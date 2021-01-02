require('dotenv').config()

const { readFile: _readFile } = require('fs')
const { join } = require('path')
const compile = require('mjml')
const { load } = require('cheerio')
const sendgrid = require('@sendgrid/client')

sendgrid.setApiKey(process.env.SENDGRID_API_KEY)

const emails = Object.entries(require('./emails.json'))

const readFile = path =>
	new Promise((resolve, reject) => {
		_readFile(path, 'utf8', (error, data) => {
			error ? reject(error) : resolve(data)
		})
	})

const getDefaultVersionId = async templateId => {
	const [{ body }] = await sendgrid.request({
		method: 'GET',
		url: `/v3/templates/${templateId}`
	})
	
	const version = body.versions
		.find(({ name }) => name === 'default')
	
	if (version)
		return version.id
	
	throw new Error(`Unable to find the default version for template ${templateId}`)
}

if (require.main === module) {
	let i = 0
	
	Promise.all(emails.map(async ([name, id]) => {
		const path = join(__dirname, 'src', `${name}.mjml`)
		
		const { html } = compile(await readFile(path), {
			validationLevel: 'strict',
			minify: true,
			filePath: path
		})
		
		await sendgrid.request({
			method: 'PATCH',
			url: `/v3/templates/${id}/versions/${await getDefaultVersionId(id)}`,
			body: {
				subject: load(html)('title').text(),
				html_content: html,
				active: 1
			}
		})
		
		console.log(`Uploaded ${name} (${++i}/${emails.length})`)
	}))
}
