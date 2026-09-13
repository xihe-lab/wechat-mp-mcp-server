#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio'
import { registerAuthTools } from './tools/auth'
import { registerMediaTools } from './tools/media'
import { registerDraftTools } from './tools/draft'
import { registerPublishTools } from './tools/publish'
import { registerWebhubTools } from './tools/webhub'
import { registerStatsTools } from './tools/stats'
import { registerHtmlCheckTools } from './tools/htmlcheck'
import { logInfo, logError } from './logger'

const server = new McpServer({
  name: 'wechat-mp-mcp-server',
  version: '0.2.0',
})

registerAuthTools(server)
registerMediaTools(server)
registerDraftTools(server)
registerPublishTools(server)
registerWebhubTools(server)
registerStatsTools(server)
registerHtmlCheckTools(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  logInfo('WeChat MCP Server running on stdio')
}

main().catch((error) => {
  logError('Fatal error in main()', error)
  process.exit(1)
})
