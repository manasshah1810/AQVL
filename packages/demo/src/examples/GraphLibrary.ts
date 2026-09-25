/**
 * Graph examples. Every algorithm is written out in full — vertex variables,
 * WHILE / LOOP / IF, recursive FUNCTIONs, a real QUEUE or STACK of vertices,
 * fields such as v.visited / v.dist / v.parent — so each step of the search
 * is visible on the graph and logged in the console. Nothing is hidden inside
 * a one-line command.
 *
 * The graph vocabulary used throughout:
 *   VERTEX(g, "A")      the vertex named A          VERTEX_AT(g, i)   the i-th vertex (from 0)
 *   VERTEX_COUNT(g)     number of vertices          EDGE_COUNT(g)     number of edges
 *   DEGREE(v)           number of neighbours of v   NEIGHBOR(v, i)    v's i-th neighbour (from 0)
 *   IN_DEGREE(v)        edges coming into v         WEIGHT(u, w)      weight of the edge u -> w
 *   HAS_EDGE(u, w)      TRUE when u -> w exists     EDGE_AT(g, i)     the i-th edge (e.from, e.to, e.weight)
 *   ADD_VERTEX / ADD_EDGE / REMOVE_EDGE / REMOVE_VERTEX change the graph.
 *
 * Neighbour loops are written `i = 0 / WHILE i < DEGREE(v) ... i = i + 1`,
 * which also works for a vertex with no neighbours (DEGREE 0).
 */
export const GraphScripts = {
  GraphBasics: `SCENE GraphBasics
// A graph is a set of VERTICES (here: people) joined by EDGES (friendships).
// "Asha-Ben" is an UNDIRECTED edge: the friendship goes both ways.
// Every vertex keeps an ADJACENCY LIST — the vertices it is directly
// connected to. DEGREE(v) is the length of that list.

DECLARE
  GRAPH friends = ["Asha-Ben", "Asha-Chen", "Ben-Dev", "Chen-Dev", "Dev-Esha", "Ravi"]

SEQUENCE
  // 1. The whole graph, printed as adjacency lists.
  PRINT "Adjacency list:" friends
  PRINT "People:" VERTEX_COUNT(friends) "  Friendships:" EDGE_COUNT(friends)

  // 2. Visit every vertex by its index and list its neighbours.
  LOOP i FROM 0 TO VERTEX_COUNT(friends) - 1
    person = VERTEX_AT(friends, i)
    names = ""
    j = 0
    WHILE j < DEGREE(person)
      friend = NEIGHBOR(person, j)
      names = names + " " + friend.name
      j = j + 1
    END
    IF DEGREE(person) == 0
      PRINT person.name "has no friends in this network yet"
    ELSE
      PRINT person.name "has" DEGREE(person) "friend(s):" names
    END
  END

  // 3. The most connected person = the vertex with the highest degree.
  best = VERTEX_AT(friends, 0)
  LOOP i FROM 1 TO VERTEX_COUNT(friends) - 1
    person = VERTEX_AT(friends, i)
    IF DEGREE(person) > DEGREE(best)
      best = person
    END
  END
  PRINT "Most connected:" best.name "with" DEGREE(best) "friends"

  // 4. Is there a direct edge between two people?
  asha = VERTEX(friends, "Asha")
  dev = VERTEX(friends, "Dev")
  IF HAS_EDGE(asha, dev)
    PRINT "Asha and Dev are direct friends"
  ELSE
    PRINT "Asha and Dev are NOT direct friends (they share friends Ben and Chen)"
  END

  // 5. Graphs change: Ravi joins in, Chen and Dev fall out.
  ADD_EDGE friends "Ravi" "Esha"
  ADD_VERTEX friends "Gita"
  ADD_EDGE friends "Gita" "Asha"
  REMOVE_EDGE friends "Chen" "Dev"
  PRINT "After the changes:" friends

  // 6. Handshake lemma: every edge adds 1 to the degree of BOTH its ends,
  //    so the degrees always add up to twice the number of edges.
  total = 0
  LOOP i FROM 0 TO VERTEX_COUNT(friends) - 1
    person = VERTEX_AT(friends, i)
    total = total + DEGREE(person)
  END
  PRINT "Sum of all degrees =" total "= 2 x" EDGE_COUNT(friends) "edges"
END
`,

  DirectedWeighted: `SCENE FlightRoutes
// A DIRECTED graph: "DEL->BOM:2" is a one-way flight from Delhi to Mumbai
// that takes 2 hours (the edge WEIGHT). Flights out of an airport are its
// OUT-degree, flights into it its IN-degree.

DECLARE
  GRAPH flights = ["DEL->BOM:2", "DEL->CCU:2", "BOM->GOI:1", "BOM->BLR:2", "GOI->BLR:1", "CCU->BLR:2", "CCU->MAA:3", "BLR->MAA:1", "MAA->DEL:3"]

SEQUENCE
  PRINT "Routes:" flights

  // 1. Departures from every airport, with their durations.
  LOOP i FROM 0 TO VERTEX_COUNT(flights) - 1
    airport = VERTEX_AT(flights, i)
    departures = ""
    j = 0
    WHILE j < DEGREE(airport)
      destination = NEIGHBOR(airport, j)
      departures = departures + " " + destination.name + "(" + WEIGHT(airport, destination) + "h)"
      j = j + 1
    END
    PRINT airport.name ": out" DEGREE(airport) " in" IN_DEGREE(airport) " ->" departures
  END

  // 2. The busiest airport: most flights in and out together.
  busiest = VERTEX_AT(flights, 0)
  LOOP i FROM 1 TO VERTEX_COUNT(flights) - 1
    airport = VERTEX_AT(flights, i)
    IF DEGREE(airport) + IN_DEGREE(airport) > DEGREE(busiest) + IN_DEGREE(busiest)
      busiest = airport
    END
  END
  PRINT "Busiest airport:" busiest.name

  // 3. Direction matters: DEL -> BOM exists, BOM -> DEL does not.
  del = VERTEX(flights, "DEL")
  bom = VERTEX(flights, "BOM")
  IF HAS_EDGE(del, bom)
    PRINT "Direct flight DEL -> BOM takes" WEIGHT(del, bom) "hours"
  END
  IF HAS_EDGE(bom, del) == FALSE
    PRINT "No direct flight BOM -> DEL (edges are one-way)"
  END

  // 4. Walk the edge list itself: longest flight and total flying hours.
  longest = EDGE_AT(flights, 0)
  hours = 0
  LOOP k FROM 0 TO EDGE_COUNT(flights) - 1
    flight = EDGE_AT(flights, k)
    hours = hours + flight.weight
    IF flight.weight > longest.weight
      longest = flight
    END
  END
  PRINT "Longest flight:" longest "  Total hours on the timetable:" hours

  // 5. A new route opens.
  ADD_EDGE flights "GOI" "DEL" 2
  PRINT "GOI now has" DEGREE(VERTEX(flights, "GOI")) "departures"
END
`,

  AdjacencyMatrix: `SCENE AdjacencyMatrix
// The same graph stored two ways:
//  - adjacency LIST: each vertex lists its neighbours (what AQVL keeps),
//  - adjacency MATRIX: a V x V table, cell [row][col] = 1 when an edge exists.
// We build the matrix row by row with two nested loops and HAS_EDGE.

DECLARE
  GRAPH g = ["A-B", "A-C", "B-C", "C-D", "D-E"]

SEQUENCE
  PRINT "Adjacency list:" g

  n = VERTEX_COUNT(g)
  header = "   "
  LOOP col FROM 0 TO n - 1
    v = VERTEX_AT(g, col)
    header = header + " " + v.name
  END
  PRINT header

  ones = 0
  LOOP row FROM 0 TO n - 1
    u = VERTEX_AT(g, row)
    line = u.name + " |"
    LOOP col FROM 0 TO n - 1
      v = VERTEX_AT(g, col)
      IF HAS_EDGE(u, v)
        line = line + " 1"
        ones = ones + 1
      ELSE
        line = line + " 0"
      END
    END
    PRINT line
  END

  // Undirected: every edge appears twice (A->B and B->A), so the matrix
  // is symmetric and the number of 1s is 2 x edges.
  PRINT "Cells with 1:" ones "  edges =" ones / 2
  PRINT "Matrix size:" n * n "cells.  List size:" 2 * EDGE_COUNT(g) "entries"
  PRINT "A sparse graph (few edges) is cheaper as a list; a dense one fits a matrix."
END
`,

  BreadthFirstSearch: `SCENE BreadthFirstSearch
// Breadth-first search (BFS) explores a graph in rings: first every direct
// friend of the start, then every friend-of-a-friend, and so on.
// A QUEUE holds the vertices waiting to be explored (first in, first out),
// and v.visited makes sure no vertex joins the queue twice.
// v.dist = number of edges from the start ("degrees of separation").

DECLARE
  GRAPH people = ["Asha-Ben", "Asha-Chen", "Ben-Dev", "Chen-Dev", "Chen-Esha", "Dev-Ravi", "Esha-Ravi", "Ravi-Gita", "Mia-Noor"]
  QUEUE q = []

SEQUENCE
  start = VERTEX(people, "Asha")
  start.visited = TRUE
  start.dist = 0
  ENQUEUE q start

  order = ""
  WHILE LENGTH(q) > 0
    v = DEQUEUE(q)
    order = order + " " + v.name
    // Look at every neighbour; the unvisited ones are one step further out.
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.visited == FALSE
        w.visited = TRUE
        w.dist = v.dist + 1
        w.parent = v
        ENQUEUE q w
      END
      i = i + 1
    END
  END
  PRINT "BFS visiting order:" order

  // Group everyone by their distance from Asha.
  far = 0
  LOOP k FROM 0 TO VERTEX_COUNT(people) - 1
    p = VERTEX_AT(people, k)
    IF p.visited AND p.dist > far
      far = p.dist
    END
  END
  LOOP d FROM 1 TO far
    ring = ""
    LOOP k FROM 0 TO VERTEX_COUNT(people) - 1
      p = VERTEX_AT(people, k)
      IF p.visited AND p.dist == d
        ring = ring + " " + p.name
      END
    END
    PRINT d "step(s) from Asha:" ring
  END

  // Anyone never reached is in a different part of the network.
  LOOP k FROM 0 TO VERTEX_COUNT(people) - 1
    p = VERTEX_AT(people, k)
    IF p.visited == FALSE
      PRINT p.name "cannot be reached from Asha"
    END
  END
END
`,

  ShortestPathBFS: `SCENE FewestMetroStops
// In an unweighted graph BFS finds the path with the FEWEST edges: the
// first time it reaches a vertex is along a shortest route. Each vertex
// remembers where it was reached from (parent); walking the parents back
// from the goal gives the route in reverse, so a STACK turns it around.

DECLARE
  GRAPH metro = ["Park-Mall", "Park-Lake", "Mall-Zoo", "Lake-Fort", "Fort-Zoo", "Mall-Hub", "Zoo-Dock", "Hub-Dock", "Fort-Bay"]
  QUEUE q = []
  STACK route = []

SEQUENCE
  source = VERTEX(metro, "Park")
  goal = VERTEX(metro, "Dock")

  source.visited = TRUE
  source.parent = NULL
  ENQUEUE q source
  found = FALSE
  // Stop as soon as the goal has been reached.
  WHILE LENGTH(q) > 0 AND found == FALSE
    station = DEQUEUE(q)
    i = 0
    WHILE i < DEGREE(station)
      next = NEIGHBOR(station, i)
      IF next.visited == FALSE
        next.visited = TRUE
        next.parent = station
        ENQUEUE q next
        IF next == goal
          found = TRUE
        END
      END
      i = i + 1
    END
  END

  IF found == FALSE
    PRINT "Dock cannot be reached from Park"
  ELSE
    // Walk back from the goal to the source, pushing each station.
    stops = 0
    curr = goal
    WHILE curr != NULL
      PUSH route curr
      curr = curr.parent
    END
    // Popping gives the stations from source to goal.
    path = ""
    WHILE LENGTH(route) > 0
      s = POP(route)
      path = path + " " + s.name
      stops = stops + 1
    END
    PRINT "Route:" path
    PRINT "Stops travelled:" stops - 1
  END
END
`,

  DepthFirstSearch: `SCENE DepthFirstSearch
// Depth-first search (DFS) explores like a person in a maze: keep walking
// into a new room, and only when there is nowhere new to go, back up to the
// most recent room that still has an unexplored door.
// A STACK holds the rooms still to explore (last in, first out).
// Neighbours are pushed in REVERSE order so they are explored in list order.

DECLARE
  GRAPH maze = ["Gate-Hall", "Hall-Lib", "Hall-Pool", "Lib-Tower", "Pool-Cave", "Cave-Tower", "Tower-Vault", "Cave-Well"]
  STACK s = []

SEQUENCE
  PUSH s VERTEX(maze, "Gate")
  order = ""
  WHILE LENGTH(s) > 0
    room = POP(s)
    // A room can be pushed more than once; explore it only the first time.
    IF room.visited == FALSE
      room.visited = TRUE
      order = order + " " + room.name
      i = DEGREE(room) - 1
      WHILE i >= 0
        door = NEIGHBOR(room, i)
        IF door.visited == FALSE
          PUSH s door
        END
        i = i - 1
      END
    END
  END
  PRINT "DFS exploring order:" order

  // Compare with BFS: DFS dives down one corridor (Hall, Lib, Tower, ...)
  // before coming back for Pool, while BFS would finish Hall's doors first.
  count = 0
  LOOP k FROM 0 TO VERTEX_COUNT(maze) - 1
    r = VERTEX_AT(maze, k)
    IF r.visited
      count = count + 1
    END
  END
  PRINT "Rooms explored:" count "of" VERTEX_COUNT(maze)
END
`,

  RecursiveDFS: `SCENE WebCrawler
// Recursive DFS: to crawl a page, mark it visited, then crawl every linked
// page that has not been visited yet. The call stack (purple vertices) is
// the trail back to the start — each RETURN backtracks one step.
// The graph is DIRECTED: a link goes from one page to another.
// crawl() RETURNS how many new pages it found, so the counts add up on the
// way back out of the recursion.

DECLARE
  GRAPH site = ["Home->About", "Home->Blog", "Blog->Post1", "Blog->Post2", "Post2->Home", "About->Team", "Team->Blog", "Old->Home"]

  FUNCTION crawl(page)
    page.visited = TRUE
    PRINT "Crawling" page.name
    found = 1
    i = 0
    WHILE i < DEGREE(page)
      linked = NEIGHBOR(page, i)
      IF linked.visited == FALSE
        found = found + crawl(linked)
      ELSE
        PRINT "  " page.name "->" linked.name "already crawled, skip"
      END
      i = i + 1
    END
    RETURN found
  END

SEQUENCE
  total = crawl(VERTEX(site, "Home"))
  PRINT "Pages reachable from Home:" total

  // A page no link leads to (an orphan) is never found by the crawler.
  LOOP k FROM 0 TO VERTEX_COUNT(site) - 1
    page = VERTEX_AT(site, k)
    IF page.visited == FALSE
      PRINT "Orphan page (no links to it from Home's pages):" page.name
    END
  END
END
`,

  ConnectedComponents: `SCENE ConnectedComponents
// Which computers can talk to each other? Each group of machines joined by
// cables is a CONNECTED COMPONENT. Loop over every vertex; each time one is
// still unvisited, it starts a new group — explore everything reachable from
// it (DFS with a stack) and give them all the same group number.
// v.color = group paints each component its own colour.

DECLARE
  GRAPH lan = ["PC1-PC2", "PC2-PC3", "PC1-PC3", "PC4-PC5", "PC6", "PC7-PC8", "PC8-PC9"]
  STACK s = []

SEQUENCE
  groups = 0
  LOOP k FROM 0 TO VERTEX_COUNT(lan) - 1
    first = VERTEX_AT(lan, k)
    IF first.visited == FALSE
      groups = groups + 1
      members = ""
      PUSH s first
      first.visited = TRUE
      WHILE LENGTH(s) > 0
        pc = POP(s)
        pc.group = groups
        pc.color = groups
        members = members + " " + pc.name
        i = 0
        WHILE i < DEGREE(pc)
          other = NEIGHBOR(pc, i)
          IF other.visited == FALSE
            other.visited = TRUE
            PUSH s other
          END
          i = i + 1
        END
      END
      PRINT "Network" groups ":" members
    END
  END
  PRINT "Separate networks:" groups

  // Two computers can talk exactly when they are in the same component.
  a = VERTEX(lan, "PC3")
  b = VERTEX(lan, "PC5")
  IF a.group == b.group
    PRINT "PC3 and PC5 can talk"
  ELSE
    PRINT "PC3 and PC5 cannot talk: networks" a.group "and" b.group
  END
END
`,

  UndirectedCycle: `SCENE UndirectedCycleDetection
// Does a pipe network contain a loop? In an undirected graph, DFS finds a
// cycle when it meets an already-visited vertex that is NOT the one it just
// came from (its parent). A connected graph with no cycle is a TREE, and a
// tree with V vertices always has exactly V - 1 edges.

DECLARE
  GRAPH pipes = ["Tank-P1", "P1-P2", "P1-P3", "P3-P4", "P3-P5"]

  // Returns TRUE when a cycle is reachable from v (reached from cameFrom).
  FUNCTION hasCycle(v, cameFrom)
    v.visited = TRUE
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.visited == FALSE
        IF hasCycle(w, v)
          RETURN TRUE
        END
      ELSE
        IF w != cameFrom
          PRINT "Loop closed by the pipe" v.name "-" w.name
          RETURN TRUE
        END
      END
      i = i + 1
    END
    RETURN FALSE
  END

  // Clears every visited mark so the search can run again.
  FUNCTION resetMarks()
    LOOP k FROM 0 TO VERTEX_COUNT(pipes) - 1
      v = VERTEX_AT(pipes, k)
      v.visited = FALSE
    END
  END

SEQUENCE
  PRINT "Vertices:" VERTEX_COUNT(pipes) " Edges:" EDGE_COUNT(pipes)
  IF hasCycle(VERTEX(pipes, "Tank"), NULL)
    PRINT "The network has a loop"
  ELSE
    PRINT "No loop: the network is a tree —" EDGE_COUNT(pipes) "edges = V - 1"
  END

  // Add one more pipe between two junctions that were already connected.
  ADD_EDGE pipes "P2" "P4"
  resetMarks()
  IF hasCycle(VERTEX(pipes, "Tank"), NULL)
    PRINT "After adding P2-P4 the network has a loop"
  ELSE
    PRINT "Still no loop"
  END
END
`,

  DirectedCycle: `SCENE CoursePrerequisiteCycle
// "A->B" means course A must be taken before course B. If the arrows form a
// cycle, nobody can ever finish the courses on it.
// Directed cycle detection uses three colours:
//   WHITE = not visited yet, GRAY = on the current DFS path, BLACK = finished.
// Reaching a GRAY vertex means we walked in a circle back onto our own path.
// Following the parent fields from v back to that vertex prints the cycle.

DECLARE
  GRAPH courses = ["Maths->Stats", "Stats->ML", "Coding->ML", "ML->AI", "AI->Ethics", "Ethics->Stats"]

  FUNCTION visit(v)
    v.color = "GRAY"
    i = 0
    WHILE i < DEGREE(v)
      w = NEIGHBOR(v, i)
      IF w.color == "GRAY"
        // Back edge v -> w: rebuild the cycle w -> ... -> v -> w.
        cycle = w.name
        curr = v
        path = ""
        WHILE curr != w
          path = " -> " + curr.name + path
          curr = curr.parent
        END
        PRINT "Cycle found:" cycle + path + " -> " + w.name
        RETURN TRUE
      END
      IF w.color == "WHITE"
        w.parent = v
        IF visit(w)
          RETURN TRUE
        END
      END
      i = i + 1
    END
    v.color = "BLACK"
    RETURN FALSE
  END

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(courses) - 1
    c = VERTEX_AT(courses, k)
    c.color = "WHITE"
    c.parent = NULL
  END

  stuck = FALSE
  LOOP k FROM 0 TO VERTEX_COUNT(courses) - 1
    c = VERTEX_AT(courses, k)
    IF stuck == FALSE AND c.color == "WHITE"
      stuck = visit(c)
    END
  END
  IF stuck
    PRINT "These prerequisites can never all be satisfied."
  ELSE
    PRINT "No cycle: every course can be scheduled."
  END
END
`,

  BipartiteCheck: `SCENE TwoTeamsBipartite
// Split players into two teams so that no two RIVALS (edge) share a team.
// That is possible exactly when the graph is BIPARTITE (2-colourable).
// BFS colours the start 0, its neighbours 1, their neighbours 0, ...
// If an edge ever joins two vertices of the SAME colour, it is impossible —
// that happens precisely when the graph has a cycle of odd length.

DECLARE
  GRAPH rivals = ["Ana-Bo", "Ana-Cy", "Bo-Dan", "Cy-Dan", "Dan-Eve", "Eve-Fay"]
  QUEUE q = []

  // Tries to 2-colour every vertex; returns FALSE at the first conflict.
  FUNCTION splitTeams()
    LOOP k FROM 0 TO VERTEX_COUNT(rivals) - 1
      p = VERTEX_AT(rivals, k)
      p.color = -1
    END
    LOOP k FROM 0 TO VERTEX_COUNT(rivals) - 1
      first = VERTEX_AT(rivals, k)
      IF first.color == -1
        first.color = 0
        ENQUEUE q first
        WHILE LENGTH(q) > 0
          p = DEQUEUE(q)
          i = 0
          WHILE i < DEGREE(p)
            r = NEIGHBOR(p, i)
            IF r.color == -1
              r.color = 1 - p.color
              ENQUEUE q r
            ELSE
              IF r.color == p.color
                PRINT "Conflict:" p.name "and" r.name "are rivals but both in team" p.color
                CLEAR q
                RETURN FALSE
              END
            END
            i = i + 1
          END
        END
      END
    END
    RETURN TRUE
  END

  // Prints the members of each team.
  FUNCTION showTeams()
    LOOP team FROM 0 TO 1
      line = ""
      LOOP k FROM 0 TO VERTEX_COUNT(rivals) - 1
        p = VERTEX_AT(rivals, k)
        IF p.color == team
          line = line + " " + p.name
        END
      END
      PRINT "Team" team ":" line
    END
  END

SEQUENCE
  IF splitTeams()
    PRINT "Two teams are possible:"
    showTeams()
  ELSE
    PRINT "No valid split"
  END

  // A new rivalry creates a triangle Dan - Eve - Fay (odd cycle of length 3).
  ADD_EDGE rivals "Dan" "Fay"
  IF splitTeams()
    showTeams()
  ELSE
    PRINT "After Dan-Fay: impossible — Dan, Eve and Fay are all rivals of each other"
  END
END
`,

  TopologicalSortKahn: `SCENE CourseScheduleKahn
// Topological order: a list of the vertices where every arrow points
// forwards — here, an order to take courses so prerequisites come first.
// Kahn's algorithm: v.need = IN_DEGREE(v) = prerequisites still missing.
// Courses with need 0 can be taken now (queue). Taking one lowers the need
// of every course it unlocks; a course whose need drops to 0 joins the queue.
// If some courses never reach 0, the prerequisites contain a cycle.

DECLARE
  GRAPH plan = ["Intro->DSA", "Intro->Web", "Maths->DSA", "DSA->Algo", "Maths->Algo", "Web->Proj", "Algo->Proj"]
  QUEUE ready = []

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(plan) - 1
    c = VERTEX_AT(plan, k)
    c.need = IN_DEGREE(c)
    IF c.need == 0
      ENQUEUE ready c
    END
  END

  order = ""
  taken = 0
  WHILE LENGTH(ready) > 0
    c = DEQUEUE(ready)
    order = order + " " + c.name
    taken = taken + 1
    c.visited = TRUE
    i = 0
    WHILE i < DEGREE(c)
      next = NEIGHBOR(c, i)
      next.need = next.need - 1
      IF next.need == 0
        ENQUEUE ready next
      END
      i = i + 1
    END
  END

  IF taken == VERTEX_COUNT(plan)
    PRINT "Take the courses in this order:" order
  ELSE
    PRINT "Cycle! Only" taken "of" VERTEX_COUNT(plan) "courses can ever be taken"
  END
END
`,

  TopologicalSortDFS: `SCENE GettingDressedDFS
// Topological sort with DFS: a vertex is FINISHED only after everything
// that must come after it is finished. Pushing each vertex onto a stack as
// it finishes, then popping the stack, lists the vertices in a valid order.
// "Socks->Shoes" = socks must go on before shoes.

DECLARE
  GRAPH dress = ["Socks->Shoes", "Pants->Shoes", "Pants->Belt", "Shirt->Belt", "Shirt->Tie", "Tie->Coat", "Belt->Coat", "Watch"]
  STACK finished = []

  FUNCTION visit(item)
    item.visited = TRUE
    i = 0
    WHILE i < DEGREE(item)
      after = NEIGHBOR(item, i)
      IF after.visited == FALSE
        visit(after)
      END
      i = i + 1
    END
    // Everything that depends on 'item' is on the stack already.
    PUSH finished item
  END

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(dress) - 1
    item = VERTEX_AT(dress, k)
    IF item.visited == FALSE
      visit(item)
    END
  END

  order = ""
  step = 1
  WHILE LENGTH(finished) > 0
    item = POP(finished)
    PRINT "Step" step ": put on" item.name
    order = order + " " + item.name
    step = step + 1
  END
  PRINT "Dressing order:" order
END
`,

  DijkstraShortestPath: `SCENE DijkstraDeliveryRoute
// Dijkstra's algorithm: shortest distances from one source in a graph with
// NON-NEGATIVE weights (here: km between places in a town).
//   1. Every place starts at distance INFINITY, the source at 0.
//   2. Repeatedly pick the unvisited place with the smallest distance —
//      its distance is now final — and RELAX its roads: if going through it
//      is shorter, update the neighbour's dist and parent.
// This version scans for the minimum with a loop (O(V^2)), no heap needed.

DECLARE
  GRAPH town = ["Shop-Mkt:4", "Shop-Park:1", "Park-Mkt:2", "Mkt-Bank:5", "Park-Gym:8", "Bank-Gym:3", "Bank-Home:6", "Gym-Home:2"]
  STACK route = []

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(town) - 1
    p = VERTEX_AT(town, k)
    p.dist = INFINITY
    p.parent = NULL
  END
  source = VERTEX(town, "Shop")
  source.dist = 0

  finished = FALSE
  WHILE finished == FALSE
    // Pick the closest place not finalised yet.
    u = NULL
    best = INFINITY
    LOOP k FROM 0 TO VERTEX_COUNT(town) - 1
      p = VERTEX_AT(town, k)
      IF p.visited == FALSE AND p.dist < best
        best = p.dist
        u = p
      END
    END

    IF u == NULL
      finished = TRUE
    ELSE
      u.visited = TRUE
      PRINT "Finalised" u.name "at" u.dist "km"
      // Relax every road out of u.
      i = 0
      WHILE i < DEGREE(u)
        v = NEIGHBOR(u, i)
        IF v.visited == FALSE
          candidate = u.dist + WEIGHT(u, v)
          IF candidate < v.dist
            v.dist = candidate
            v.parent = u
          END
        END
        i = i + 1
      END
    END
  END

  // Shortest route to Home: follow parents back, then reverse with a stack.
  curr = VERTEX(town, "Home")
  WHILE curr != NULL
    PUSH route curr
    curr = curr.parent
  END
  path = ""
  WHILE LENGTH(route) > 0
    p = POP(route)
    path = path + " " + p.name
  END
  PRINT "Shortest route Shop -> Home:" path
  PRINT "Distance:" VERTEX(town, "Home").dist "km"
END
`,

  BellmanFordAlgorithm: `SCENE BellmanFordDrone
// Bellman-Ford handles NEGATIVE weights, which Dijkstra cannot. Here the
// weight is battery used by a delivery drone; flying downhill (Ridge->Mill)
// recharges it, a negative cost.
// Relax EVERY edge, V - 1 times (a shortest path has at most V - 1 edges).
// The edges are listed "backwards" on purpose: good news travels only one
// edge further per round, so watch the distances improve round by round.
// One more round that still improves something proves a negative cycle.

DECLARE
  GRAPH air = ["Port->Dock:2", "Mill->Port:4", "Ridge->Mill:-3", "Mill->Dock:7", "Ridge->Port:6", "Base->Ridge:4", "Base->Mill:5"]

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(air) - 1
    p = VERTEX_AT(air, k)
    p.dist = INFINITY
  END
  source = VERTEX(air, "Base")
  source.dist = 0

  round = 1
  changed = TRUE
  WHILE round <= VERTEX_COUNT(air) - 1 AND changed
    changed = FALSE
    LOOP k FROM 0 TO EDGE_COUNT(air) - 1
      e = EDGE_AT(air, k)
      a = e.from
      b = e.to
      IF a.dist != INFINITY AND a.dist + e.weight < b.dist
        b.dist = a.dist + e.weight
        b.parent = a
        changed = TRUE
      END
    END
    PRINT "After round" round ": Ridge" VERTEX(air, "Ridge").dist " Mill" VERTEX(air, "Mill").dist " Port" VERTEX(air, "Port").dist " Dock" VERTEX(air, "Dock").dist
    round = round + 1
  END
  IF changed == FALSE
    PRINT "The last round changed nothing: the distances are final."
  END

  // Extra round: any further improvement means a negative cycle.
  negative = FALSE
  LOOP k FROM 0 TO EDGE_COUNT(air) - 1
    e = EDGE_AT(air, k)
    a = e.from
    b = e.to
    IF a.dist != INFINITY AND a.dist + e.weight < b.dist
      negative = TRUE
    END
  END
  IF negative
    PRINT "Negative cycle: battery could be recharged forever — no shortest path."
  ELSE
    PRINT "No negative cycle. Cheapest battery use to Dock:" VERTEX(air, "Dock").dist
  END
END
`,

  PrimsMST: `SCENE PrimsFibreNetwork
// Connect every office with fibre cable using the least total cable: a
// MINIMUM SPANNING TREE. Prim's algorithm grows one tree from a start
// office: v.key = cheapest known cable joining v to the tree so far.
// Each round adds the outside office with the smallest key, then updates
// its neighbours' keys. The parent edges (green) form the tree.

DECLARE
  GRAPH offices = ["HQ-Lab:4", "HQ-Shop:3", "Lab-Shop:1", "Lab-Depot:2", "Shop-Depot:4", "Depot-Cafe:3", "Shop-Cafe:6"]

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(offices) - 1
    o = VERTEX_AT(offices, k)
    o.key = INFINITY
    o.parent = NULL
  END
  start = VERTEX(offices, "HQ")
  start.key = 0

  total = 0
  LOOP round FROM 1 TO VERTEX_COUNT(offices)
    // The office outside the tree that is cheapest to connect.
    u = NULL
    LOOP k FROM 0 TO VERTEX_COUNT(offices) - 1
      o = VERTEX_AT(offices, k)
      IF o.visited == FALSE
        IF u == NULL
          u = o
        ELSE
          IF o.key < u.key
            u = o
          END
        END
      END
    END
    u.visited = TRUE
    total = total + u.key
    IF u.parent != NULL
      PRINT "Lay cable" u.parent.name "-" u.name ":" u.key "km"
    END
    // Offices next to u may now be cheaper to reach through u.
    i = 0
    WHILE i < DEGREE(u)
      v = NEIGHBOR(u, i)
      IF v.visited == FALSE AND WEIGHT(u, v) < v.key
        v.key = WEIGHT(u, v)
        v.parent = u
      END
      i = i + 1
    END
  END
  PRINT "Total cable:" total "km for" VERTEX_COUNT(offices) - 1 "links"
END
`,

  KruskalsMST: `SCENE KruskalsVillageRoads
// Kruskal's algorithm builds the minimum spanning tree from the edges:
// take roads from cheapest to most expensive, and keep a road only when it
// joins two villages that are NOT already connected (otherwise it would
// close a cycle). "Already connected" is answered by UNION-FIND: every
// village points (leader) towards the representative of its group.

DECLARE
  GRAPH roads = ["Ash-Bay:7", "Ash-Cove:5", "Bay-Cove:8", "Bay-Dale:9", "Bay-Elm:7", "Cove-Dale:15", "Dale-Elm:5", "Dale-Fen:6", "Elm-Fen:8", "Elm-Glen:9", "Fen-Glen:11"]

  // Follows leader pointers until a village that leads itself.
  FUNCTION findLeader(v)
    WHILE v.leader != v
      v = v.leader
    END
    RETURN v
  END

SEQUENCE
  // Every village starts as its own group.
  LOOP k FROM 0 TO VERTEX_COUNT(roads) - 1
    v = VERTEX_AT(roads, k)
    v.leader = v
  END
  LOOP k FROM 0 TO EDGE_COUNT(roads) - 1
    e = EDGE_AT(roads, k)
    e.checked = FALSE
  END

  kept = 0
  total = 0
  LOOP step FROM 1 TO EDGE_COUNT(roads)
    // Cheapest road not looked at yet.
    cheapest = NULL
    LOOP k FROM 0 TO EDGE_COUNT(roads) - 1
      e = EDGE_AT(roads, k)
      IF e.checked == FALSE
        IF cheapest == NULL
          cheapest = e
        ELSE
          IF e.weight < cheapest.weight
            cheapest = e
          END
        END
      END
    END
    cheapest.checked = TRUE

    a = findLeader(cheapest.from)
    b = findLeader(cheapest.to)
    IF a != b
      // Different groups: keep the road and merge the groups.
      cheapest.inTree = TRUE
      a.leader = b
      kept = kept + 1
      total = total + cheapest.weight
      PRINT "Keep" cheapest
    ELSE
      PRINT "Skip" cheapest "— both already connected (would make a cycle)"
    END
  END
  PRINT "Roads kept:" kept " Total length:" total
END
`,

  CountAllPaths: `SCENE AllRoutesBacktracking
// Every different way to walk from Home to School without visiting a place
// twice. This is BACKTRACKING: mark a place as used, try every way onward,
// then UNMARK it on the way back so other routes may pass through it.
// The function RETURNS how many routes it found from 'place'.

DECLARE
  GRAPH map = ["Home-Park", "Home-Mall", "Park-Mall", "Park-School", "Mall-Lib", "Lib-School", "Park-Lib"]

  FUNCTION routes(place, trail)
    IF place.name == "School"
      PRINT "Route:" trail
      RETURN 1
    END
    place.visited = TRUE
    count = 0
    i = 0
    WHILE i < DEGREE(place)
      next = NEIGHBOR(place, i)
      IF next.visited == FALSE
        count = count + routes(next, trail + " -> " + next.name)
      END
      i = i + 1
    END
    // Backtrack: free this place for the other routes.
    place.visited = FALSE
    RETURN count
  END

SEQUENCE
  total = routes(VERTEX(map, "Home"), "Home")
  PRINT "Number of different routes:" total
END
`,

  GreedyColoring: `SCENE ExamTimetableColoring
// Two exams that share a student cannot be in the same time slot (edge =
// conflict). Greedy colouring: take the exams one by one and give each the
// lowest slot number that none of its already-scheduled neighbours uses.
// v.color = slot paints each slot its own colour.

DECLARE
  GRAPH exams = ["Maths-Phys", "Maths-Chem", "Phys-Chem", "Phys-Bio", "Chem-Eng", "Bio-Eng", "Eng-Art", "Hist-Art"]

SEQUENCE
  LOOP k FROM 0 TO VERTEX_COUNT(exams) - 1
    x = VERTEX_AT(exams, k)
    x.slot = -1
  END

  slots = 0
  LOOP k FROM 0 TO VERTEX_COUNT(exams) - 1
    x = VERTEX_AT(exams, k)
    slot = 0
    clash = TRUE
    // Try slot 0, 1, 2, ... until no neighbour already uses it.
    WHILE clash
      clash = FALSE
      i = 0
      WHILE i < DEGREE(x)
        other = NEIGHBOR(x, i)
        IF other.slot == slot
          clash = TRUE
        END
        i = i + 1
      END
      IF clash
        slot = slot + 1
      END
    END
    x.slot = slot
    x.color = slot
    IF slot + 1 > slots
      slots = slot + 1
    END
  END

  LOOP s FROM 0 TO slots - 1
    line = ""
    LOOP k FROM 0 TO VERTEX_COUNT(exams) - 1
      x = VERTEX_AT(exams, k)
      IF x.slot == s
        line = line + " " + x.name
      END
    END
    PRINT "Slot" s + 1 ":" line
  END
  PRINT "Time slots needed:" slots
END
`,
};
