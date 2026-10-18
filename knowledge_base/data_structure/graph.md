# 图的遍历、图与最短路径

课程：数据结构
知识点：图的遍历、图与最短路径

## 核心概念

图可使用邻接表或邻接矩阵存储。邻接表通常占 O(V+E) 空间；邻接矩阵占 O(V*V) 空间。使用邻接表时，完整 BFS/DFS 遍历的时间通常为 O(V+E)。
BFS 使用普通队列按层扩展，无权图中首次发现的距离就是最少边数。入队时标记 visited 可避免同一顶点重复入队。
DFS 使用递归调用栈或显式栈沿路径深入并回溯。非连通图要从每个尚未访问的顶点继续启动遍历，单一起点不能覆盖其他连通分量。
经典 Dijkstra 适用于边权非负的单源最短路径。Bellman-Ford 可以处理负权边，并检测从源点可达的负权环；受这种负权环影响的顶点不存在有限最短距离。不能将无权 BFS 直接用于一般带权最短路。

## C++代码示例

```cpp
#include <cassert>
#include <queue>
#include <vector>
int main() {
    std::vector<std::vector<int>> graph{{1, 2}, {0, 3}, {0}, {1}};
    std::vector<int> distance(graph.size(), -1);
    std::queue<int> pending;
    distance[0] = 0;
    pending.push(0);
    while (!pending.empty()) {
        int u = pending.front(); pending.pop();
        for (int v : graph[u]) {
            if (distance[v] != -1) continue;
            distance[v] = distance[u] + 1;
            pending.push(v);
        }
    }
    assert(distance[3] == 2);
}
```

## 常见错误

把 DFS 的首次到达路径当成最短路径；未标记访问导致有环图无限递归；用 Dijkstra 处理任意负权图；只遍历一个连通分量却声称已遍历全图。
图算法实现还应验证顶点下标、距离加法是否溢出，以及不可达距离的哨兵值。

## 易错题分析

题102、106、107：非负权选择 Dijkstra，无权最少边数用 BFS，允许负权边时可使用 Bellman-Ford 并检查可达负权环。
题122—124：BFS 用队列，递归 DFS 使用调用栈，非连通图需要多次启动遍历。
