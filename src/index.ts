#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio'
import { registerAuthTools } from './tools/auth'
import { registerMediaTools } from './tools/media'
import { registerDraftTools } from './tools/draft'
import { registerPublishTools } from './tools/publish'
import { logInfo, logError } from './logger'

const server = new McpServer({
  name: 'wechat-mp-mcp-server',
  version: '0.1.0',
})

registerAuthTools(server)
registerMediaTools(server)
registerDraftTools(server)
registerPublishTools(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  logInfo('WeChat MCP Server running on stdio')
}

main().catch((error) => {
  logError('Fatal error in main()', error)
  process.exit(1)
})
