# 排序与查找、堆与优先队列、哈希表

课程：数据结构
知识点：排序与查找、堆与优先队列、哈希表

## 核心概念

普通二分查找要求数据按相同比较规则有序，每轮排除一半候选范围，数组查找时间为 O(log n)。数据可以包含重复元素。
直接插入排序在已经有序、能及时停止后移的情况下为 O(n)，最坏为 O(n*n)。归并排序通常为 O(n log n)，合并遇到相等元素先取左侧可保持稳定性；数组实现通常需要额外缓冲区。
二叉堆是满足堆序的完全二叉树。大根堆父结点不小于孩子，根为最大值；堆不保证所有元素全局有序。二叉堆插入和弹出堆顶最坏 O(log n)，读取堆顶 O(1)。std::priority_queue<int> 默认返回最大值。
哈希冲突是不同键落到同一哈希位置。链地址法用桶关联结构保存冲突项，开放定址法在表内寻找其他位置。分布良好、负载因子受控时平均查找 O(1)，严重冲突时最坏可退化为 O(n)。

## C++代码示例

```cpp
#include <algorithm>
#include <cassert>
#include <queue>
#include <unordered_map>
#include <vector>
int main() {
    std::vector<int> values{3, 1, 2};
    std::sort(values.begin(), values.end());
    assert(std::binary_search(values.begin(), values.end(), 2));
    std::priority_queue<int> heap;
    for (int v : values) heap.push(v);
    assert(heap.top() == 3);
    heap.pop();
    assert(heap.top() == 2);
    std::unordered_map<int, int> counts;
    ++counts[7]; ++counts[7];
    assert(counts.at(7) == 2);
}
```

## 常见错误

对无序数组直接二分；将堆数组当成完全排序数组；以为哈希冲突说明算法错误；把平均 O(1) 当成任何输入都 O(1)；误认为 std::sort 保证稳定。

## 易错题分析

题119—121：大根堆和默认 priority_queue 的 top 是最大值；插入沿树高调整为 O(log n)。
题125—127：二分需有序；有序输入的直接插入排序可为线性；归并取左侧相等元素可保留相对顺序。
题128—130：冲突需要处理，不能丢弃不同键；受控负载和良好分布下平均查找才接近常数。
