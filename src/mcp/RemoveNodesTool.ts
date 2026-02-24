import { GraphFileManager } from "../GraphFileManager.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Tool } from "./McpServer.js";

export class RemoveNodesTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'remove_nodes',
      description: 'Remove nodes or edges from a diagram file',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute or relative path to the diagram file to modify'
          },
          tab: {
            type: ['string', 'number'],
            description: 'Optional tab name or index to modify (defaults to first tab)'
          },
          ids: { 
            type: 'array', 
            description: 'Array of node/edge IDs to remove', 
            items: { 
              type: 'string', 
              description: 'Node ID'
            } 
          }
        },
        required: ['file_path', 'ids']
      }
    }
  }

  async execute({ file_path, tab, ids }) {
    if (!file_path || !ids) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path and ids are required');
    }

    const graph = await this.fileManager.loadGraph(file_path, tab);

    graph.removeNodes(ids);

    await this.fileManager.saveGraph(graph, file_path, typeof tab === 'string' ? tab : undefined);

    return {
      content: [
        {
          type: 'text',
          text: `Removed nodes: ${ids.join(', ')} from ${file_path}`,
        }
      ]
    };
  }
}