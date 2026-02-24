import { GraphFileManager } from '../GraphFileManager.js';
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Graph } from '../Graph.js';
import { Tool } from './McpServer.js';

export class NewDiagramTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'new_diagram',
      description: 'Create a new empty diagram file',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute or relative path for the diagram file (should end with .drawio)'
          },
          tab: {
            type: 'string',
            description: 'Optional initial tab name (defaults to "Page-1")'
          }
        },
        required: ['file_path']
      }
    }
  }

  async execute({ file_path, tab }) {
    if (!file_path) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path is required');
    }

    await this.fileManager.saveGraph(new Graph(), file_path, tab);

    const tabName = tab || 'Page-1';
    return {
      content: [
        {
          type: 'text',
          text: `Created new diagram: ${file_path} (tab: ${tabName})`,
        }
      ]
    };
  }
}