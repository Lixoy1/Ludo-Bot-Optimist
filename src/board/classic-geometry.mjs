export const BOARD=Object.freeze({id:"CLASSIC",viewBox:{x:0,y:0,width:1000,height:1000},grid:{columns:15,rows:15,originX:33.617188,originY:34.494141,cellPitch:62.08849},trackLength:52,maxOuterSteps:50,homeCells:5,finishStep:56,players:4,tokensPerPlayer:4});
const RAW_TRACK=[[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]];
export const TRACK_GRID=Object.freeze(Array.from({length:52},(_,index)=>{const [col,row]=RAW_TRACK[(index+13)%52];return Object.freeze({index,col,row});}));
const ROWS={
 yellow:{label:"YELLOW",startIndex:0,baseCorner:"top-right",baseSlots:[[11,2],[13,2],[11,4],[13,4]],homeLane:[[7,1],[7,2],[7,3],[7,4],[7,5]],finishCell:[7,6]},
 blue:{label:"BLUE",startIndex:13,baseCorner:"bottom-right",baseSlots:[[11,11],[13,11],[11,13],[13,13]],homeLane:[[13,7],[12,7],[11,7],[10,7],[9,7]],finishCell:[8,7]},
 red:{label:"RED",startIndex:26,baseCorner:"bottom-left",baseSlots:[[2,11],[4,11],[2,13],[4,13]],homeLane:[[7,13],[7,12],[7,11],[7,10],[7,9]],finishCell:[7,8]},
 green:{label:"GREEN",startIndex:39,baseCorner:"top-left",baseSlots:[[2,2],[4,2],[2,4],[4,4]],homeLane:[[1,7],[2,7],[3,7],[4,7],[5,7]],finishCell:[6,7]}
};
export const PLAYER_CONFIG=Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([color,c])=>[color,Object.freeze({...c,homeEntryIndex:(c.startIndex+50)%52})])));
export const COLORS=Object.freeze(["yellow","blue","red","green"]);
export const SAFE_TRACK_INDICES=Object.freeze([0,8,13,21,26,34,39,47]);
export function cellCenter(col,row){if(!Number.isInteger(col)||!Number.isInteger(row)||col<0||col>14||row<0||row>14)throw new RangeError("Grid coordinates must be integers 0..14.");const g=BOARD.grid;return{x:g.originX+(col+.5)*g.cellPitch,y:g.originY+(row+.5)*g.cellPitch};}
export function baseSlotPoint(color,index){const c=PLAYER_CONFIG[color];if(!c||!Number.isInteger(index)||index<0||index>3)throw new RangeError("Invalid base slot.");const g=BOARD.grid,[x,y]=c.baseSlots[index];return{x:g.originX+x*g.cellPitch,y:g.originY+y*g.cellPitch};}
export function getTrackCell(index){if(!Number.isInteger(index)||index<0||index>=52)throw new RangeError("Track index out of range.");const p=TRACK_GRID[index];return{...p,...cellCenter(p.col,p.row)};}
export function getHomeCell(color,index){const c=PLAYER_CONFIG[color];if(!c||!Number.isInteger(index)||index<0||index>4)throw new RangeError("Invalid home cell.");const [col,row]=c.homeLane[index];return{col,row,index,...cellCenter(col,row)};}
export function getFinishAnchor(color){const c=PLAYER_CONFIG[color];if(!c)throw new RangeError("Unknown color.");const [col,row]=c.finishCell;return{col,row,...cellCenter(col,row)};}
export function getFinishSlots(color){const a=getFinishAnchor(color),o=BOARD.grid.cellPitch*.14;return[[-o,-o],[o,-o],[-o,o],[o,o]].map(([x,y])=>({x:a.x+x,y:a.y+y}));}
