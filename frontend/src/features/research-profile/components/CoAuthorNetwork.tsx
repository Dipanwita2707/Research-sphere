import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Users, Filter, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { CoAuthor, NetworkNode, NetworkEdge } from '@/shared/types/research-profile.types';

interface CoAuthorNetworkProps {
  coAuthors: CoAuthor[];
  mainAuthorName: string;
  onNodeClick?: (coAuthor: CoAuthor) => void;
}

interface NetworkFilters {
  minCollaborations: number;
  timeRange: 'all' | 'recent' | 'last5years';
  showLabels: boolean;
}

export default function CoAuthorNetwork({ 
  coAuthors, 
  mainAuthorName, 
  onNodeClick 
}: CoAuthorNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [filters, setFilters] = useState<NetworkFilters>({
    minCollaborations: 1,
    timeRange: 'all',
    showLabels: true,
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Convert coAuthors to network data
  const networkData = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    // Filter co-authors based on filters
    const filteredCoAuthors = coAuthors.filter(coAuthor => {
      if (coAuthor.collaborationCount < filters.minCollaborations) return false;
      
      if (filters.timeRange === 'recent') {
        return coAuthor.lastCollaboration >= currentYear - 2;
      } else if (filters.timeRange === 'last5years') {
        return coAuthor.lastCollaboration >= currentYear - 5;
      }
      
      return true;
    });

    // Create nodes
    const nodes: NetworkNode[] = [
      {
        id: 'main',
        name: mainAuthorName,
        affiliation: 'SGT University',
        collaborationCount: 0,
        isMainAuthor: true,
      },
      ...filteredCoAuthors.map(coAuthor => ({
        id: coAuthor.id,
        name: coAuthor.name,
        affiliation: coAuthor.affiliation || 'Unknown',
        collaborationCount: coAuthor.collaborationCount,
        isMainAuthor: false,
      })),
    ];

    // Create edges (connections between main author and co-authors)
    const edges: NetworkEdge[] = filteredCoAuthors.map(coAuthor => ({
      source: 'main',
      target: coAuthor.id,
      weight: coAuthor.collaborationCount,
      publications: coAuthor.sharedPublications,
    }));

    return { nodes, edges };
  }, [coAuthors, mainAuthorName, filters]);

  useEffect(() => {
    if (!svgRef.current || networkData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 600;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Create main group
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create force simulation
    const simulation = d3.forceSimulation(networkData.nodes as any)
      .force('link', d3.forceLink(networkData.edges)
        .id((d: any) => d.id)
        .distance(d => Math.max(100, 200 - (d as any).weight * 10))
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter((width - margin.left - margin.right) / 2, (height - margin.top - margin.bottom) / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create links
    const links = g.selectAll('.link')
      .data(networkData.edges)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.weight) * 2);

    // Create nodes
    const nodes = g.selectAll('.node')
      .data(networkData.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Add circles to nodes
    nodes.append('circle')
      .attr('r', d => d.isMainAuthor ? 20 : Math.max(8, Math.sqrt(d.collaborationCount) * 3))
      .attr('fill', d => d.isMainAuthor ? '#4285f4' : '#34a853')
      .attr('stroke', d => selectedNode === d.id ? '#ea4335' : '#fff')
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 2)
      .on('click', (event, d) => {
        setSelectedNode(selectedNode === d.id ? null : d.id);
        if (!d.isMainAuthor && onNodeClick) {
          const coAuthor = coAuthors.find(ca => ca.id === d.id);
          if (coAuthor) onNodeClick(coAuthor);
        }
      })
      .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke-width', 3);
        
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .html(`
            <strong>${d.name}</strong><br/>
            ${d.affiliation}<br/>
            ${d.isMainAuthor ? 'Main Author' : `${d.collaborationCount} collaborations`}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        if (selectedNode !== d.id) {
          d3.select(this).attr('stroke-width', 2);
        }
        d3.selectAll('.tooltip').remove();
      });

    // Add labels if enabled
    if (filters.showLabels) {
      nodes.append('text')
        .text(d => d.name.split(' ').slice(0, 2).join(' ')) // First two names
        .attr('text-anchor', 'middle')
        .attr('dy', d => d.isMainAuthor ? 35 : 25)
        .attr('font-size', d => d.isMainAuthor ? '12px' : '10px')
        .attr('font-weight', d => d.isMainAuthor ? 'bold' : 'normal')
        .attr('fill', '#333')
        .style('pointer-events', 'none');
    }

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);
    });

    // Cleanup function
    return () => {
      simulation.stop();
    };
  }, [networkData, filters.showLabels, selectedNode, coAuthors, onNodeClick]);

  const resetZoom = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
    }
  };

  if (coAuthors.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No co-authors yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Co-author network will appear here once publications with multiple authors are added.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            Min collaborations:
          </label>
          <select
            value={filters.minCollaborations}
            onChange={(e) => setFilters(prev => ({ ...prev, minCollaborations: parseInt(e.target.value) }))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={1}>1+</option>
            <option value={2}>2+</option>
            <option value={3}>3+</option>
            <option value={5}>5+</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            Time range:
          </label>
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All time</option>
            <option value="recent">Recent (2 years)</option>
            <option value="last5years">Last 5 years</option>
          </select>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.showLabels}
            onChange={(e) => setFilters(prev => ({ ...prev, showLabels: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Show labels</span>
        </label>

        <button
          onClick={resetZoom}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset view
        </button>
      </div>

      {/* Network Visualization */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Co-Author Network
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {networkData.nodes.length - 1} co-authors • {networkData.edges.length} connections
          </div>
        </div>
        
        <div className="relative">
          <svg ref={svgRef} className="w-full border border-gray-200 dark:border-gray-600 rounded" />
          
          {/* Legend */}
          <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Main author</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Co-authors</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Drag nodes to rearrange • Click nodes for details • Scroll to zoom • Node size indicates collaboration frequency
        </div>
      </div>

      {/* Collaboration Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {coAuthors.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Co-authors</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {coAuthors.reduce((sum, ca) => sum + ca.collaborationCount, 0)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Collaborations</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.max(...coAuthors.map(ca => ca.collaborationCount), 0)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Most Collaborations</div>
        </div>
      </div>

      {/* Top Collaborators */}
      {coAuthors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Collaborators
          </h4>
          <div className="space-y-3">
            {coAuthors
              .sort((a, b) => b.collaborationCount - a.collaborationCount)
              .slice(0, 5)
              .map((coAuthor) => (
                <div key={coAuthor.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {coAuthor.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {coAuthor.affiliation}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {coAuthor.collaborationCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      collaborations
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}