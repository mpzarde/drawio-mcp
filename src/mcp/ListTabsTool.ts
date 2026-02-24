import { GraphFileManager } from "../GraphFileManager.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Tool } from "./McpServer.js";

export class ListTabsTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'list_tabs',
      description: 'List all tabs/pages in a diagram file with their statistics',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute or relative path to the diagram file'
          }
        },
        required: ['file_path']
      }
    }
  }

  async execute({ file_path }) {
    if (!file_path) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path is required');
    }

    try {
      const tabs = await this.fileManager.listTabs(file_path);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file: file_path,
              tabs
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to list tabs: ${error.message}`);
    }
  }
}
