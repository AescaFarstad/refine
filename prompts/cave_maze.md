

Let's plan maze navigation feature.

maze layout consists of owned cells from research.
the player is an entity in the cells of the maze. it can travel from cell to cell.
it is drawn as a triangle with a triangle protrusion at it's back so that it would look pointy in the direction of looking.
It is looking either at teh mouse pointer or in the direction of future travel
user clicks on a cell, the avatar moves there in a shortest path (travel cost is constant)
when user hovers ovre cell, the path is displayed as a line from avatar to destination.
there is movement pool which is based on available time flux.
moving doesn't spend time flux, but the sum of all movement can't exceed it.
the game is to visit as much as possible in the labirinth and return to the entrance. or else all gains are lost.
once the avatar is at the entrance - time flux pool resets, all resources reset
the player will be collecting resources - credits, chronotraces, shardDust and possibly others like countable gear.
to collect resource player must move into the cell which contains it
resources are placed in the center of the research nodes.
gear nodes spawn chronotraces. amount = hex distance from 0,0 cell
resource nodes spawn credits. amount obeys the same rules
except sharddust resource - it spawns shards
stats nodes spawn credits too
that's it for now

Player gets only the resources which exceeded their previous highest.
So if on the first attempt player gathers 100 chronotraces and 50 credits they get these exact amounts. Then on the second attempt they gather 200 of each - they get 100 chronotraces and 150 credits.
these calculations are done when player arrives at the entrance
if tehy fail to get to the entrance because not enough time flux - they are forcibly reset and placed at the entrance. pools and resources reset too.

player travel will be animated in view.
There are two levels of state: transient one and persistent
persistent: highest earned resources of each type
transient: which resources are taken in this attempt, time flux pool used, avatar position
resource locations and amounts are derrived
savegame only contains only persistent. loading game forcibly resets the player to the entrance
entrance is the center of disc_maze_navigation research node

view animates avatar movement and sends cmd when it arrives (so that the resource becomes marked as taken only at the end)
payouts at the end are derrived from marked taken resources
drawn travel path may be drawn in two colors if the time flux pool is not enough: the remaining part in one color and the path for which there is not enough resources - in red.

Step one: refine game plan and description, resolve ambiguities.


The tab is visible when tab discovery is made, but it displays:
'This is the Maze of Time.
You will have to navigate it to return home.
Yet there seems to be no entrance.'

instead of the maze

don't do mazeHighestResources table. have each resoruce listed explicitly as a property.
same for MazeTransientState
let's not convert numbers to strings for no reason. takenCells: array<Point2>

state needed for animation will be tracked in vue separately. so no movePath, moveAnimProgress and facingAngle.

MazeTransientState will live in gameState too.
MazeResourceSpawn can live on GameState. But it's not saved, derrived on load.


CmdMazeForceReset is not needed. CmdMazeMoveTo fully encompasses it. If moved to entrance -> reset. if moved when not enough time flux -> reset.

BFS should live in a separate file

On research node purchase derrived state needs to be recalculated.
taken resources are still drawn, but they are grayed out

Layers: resources change rarely, we can include them in the base layer. we will redraw it when they are taken/reset
path needs a separate layer
player avatar is a tiny thing. it can be it's own tiny canvas moving/rotating instead fo being redrawn

resources are drawn as color-coded glyphs. amounts are not shown

I want to smooth hex boundaries. What can you suggest?