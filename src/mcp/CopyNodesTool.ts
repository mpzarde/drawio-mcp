import { GraphFileManager } from "../GraphFileManager.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Tool } from "./McpServer.js";

export class CopyNodesTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'copy_nodes',
      description: 'Copy nodes from one diagram file/tab to another, optionally with connected edges',
      inputSchema: {
        type: 'object',
        properties: {
          source_file: {
            type: 'string',
            description: 'Path to the source diagram file'
          },
          source_tab: {
            type: ['string', 'number'],
            description: 'Optional source tab name or index (defaults to first tab)'
          },
          node_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of node IDs to copy'
          },
          target_file: {
            type: 'string',
            description: 'Path to the target diagram file'
          },
          target_tab: {
            type: ['string', 'number'],
            description: 'Optional target tab name or index (defaults to first tab, or creates new tab if specified)'
          },
          offset_x: {
            type: 'number',
            default: 0,
            description: 'X offset to apply to copied nodes'
          },
          offset_y: {
            type: 'number',
            default: 0,
            description: 'Y offset to apply to copied nodes'
          },
          id_prefix: {
            type: 'string',
            description: 'Prefix to add to copied node IDs (e.g., "copy_" makes "node1" → "copy_node1")'
          },
          id_mapping: {
            type: 'object',
            description: 'Explicit ID mapping for copied nodes (e.g., {"node1": "new_node1"})'
          },
          copy_connected_edges: {
            type: 'boolean',
            default: false,
            description: 'Whether to copy edges between the copied nodes'
          }
        },
        required: ['source_file', 'node_ids', 'target_file']
      }
    }
  }

  async execute({ source_file, source_tab, node_ids, target_file, target_tab, offset_x = 0, offset_y = 0, id_prefix, id_mapping = {}, copy_connected_edges = false }) {
    if (!source_file || !node_ids || !node_ids.length || !target_file) {
      throw new McpError(ErrorCode.InvalidParams, 'source_file, node_ids, and target_file are required');
    }

    try {
      // Load source graph
      const sourceGraph = await this.fileManager.loadGraph(source_file, source_tab);

      // Extract node information
      const nodesToCopy: any[] = [];
      for (const nodeId of node_ids) {
        const nodeInfo = sourceGraph.getNodeInfo(nodeId);
        if (!nodeInfo) {
          throw new McpError(ErrorCode.InvalidParams, `Node "${nodeId}" not found in source diagram`);
        }
        nodesToCopy.push(nodeInfo);
      }

      // Build ID mapping
      const finalIdMapping: Record<string, string> = {};
      for (const node of nodesToCopy) {
        if (id_mapping[node.id]) {
          finalIdMapping[node.id] = id_mapping[node.id];
        } else if (id_prefix) {
          finalIdMapping[node.id] = id_prefix + node.id;
        } else {
          finalIdMapping[node.id] = node.id;
        }
      }

      // Load target graph (or create new if file doesn't exist)
      let targetGraph;
      try {
        targetGraph = await this.fileManager.loadGraph(target_file, target_tab);
      } catch (e: any) {
        // If file doesn't exist, create new graph
        const { Graph } = await import('../Graph.js');
        targetGraph = new Graph();
      }

      // Copy nodes to target
      for (const node of nodesToCopy) {
        const newId = finalIdMapping[node.id];
        targetGraph.addNode({
          id: newId,
          title: node.title,
          kind: node.kind,
          x: node.x + offset_x,
          y: node.y + offset_y,
          width: node.width,
          height: node.height,
          data: node.data
        });
      }

      // Copy connected edges if requested
      if (copy_connected_edges) {
        const sourceNodeIds = new Set(node_ids);
        const cells = sourceGraph.model.cells;

        for (const cellId in cells) {
          const cell = cells[cellId];
          if (cell && cell.edge) {
            const source = cell.source?.getId();
            const target = cell.target?.getId();

            // Only copy edge if both endpoints are in the copied nodes
            if (source && target && sourceNodeIds.has(source) && sourceNodeIds.has(target)) {
              const newSourceId = finalIdMapping[source];
              const newTargetId = finalIdMapping[target];

              targetGraph.linkNodes({
                from: newSourceId,
                to: newTargetId,
                title: cell.getValue() || undefined
              });
            }
          }
        }
      }

      // Save target graph
      await this.fileManager.saveGraph(targetGraph, target_file, typeof target_tab === 'string' ? target_tab : undefined);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully copied ${nodesToCopy.length} node(s) from ${source_file} to ${target_file}\n\nID Mapping:\n${JSON.stringify(finalIdMapping, null, 2)}`
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to copy nodes: ${error.message}`);
    }
  }
}
