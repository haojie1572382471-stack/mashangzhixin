# STL容器、动态内存

课程：C++
知识点：STL容器、动态内存

## 核心概念

std::vector 使用连续存储，支持 O(1) 下标随机访问。push_back 增加 size；扩容可能使已有指针、引用和迭代器失效。reserve 调整容量预留，不直接增加元素数量。
std::map 的键按比较器定义的等价关系保持唯一；通常支持 O(log n) 查找。std::list 不支持常数时间下标访问。
new 与 delete 配对，new[] 与 delete[] 配对。对象销毁后，指向它的旧指针成为悬空指针，不能解引用或再次释放。
RAII 让资源生命周期跟随对象生命周期。std::unique_ptr 表示独占所有权，不可复制，可通过移动转移；std::make_unique 可以避免手写配对释放。

## C++代码示例

```cpp
#include <cassert>
#include <map>
#include <memory>
#include <utility>
#include <vector>
int main() {
    std::vector<int> v{1, 2};
    v.push_back(3);
    assert(v.size() == 3 && v[2] == 3);
    std::map<int, int> scores;
    scores[1] = 80;
    scores[1] = 90; // 更新同一键的值
    assert(scores.size() == 1);
    auto owner = std::make_unique<int>(7);
    auto next = std::move(owner);
    assert(!owner && *next == 7);
    auto array = std::make_unique<int[]>(5);
    array[0] = 42;
} // 智能指针自动释放各自资源
```

## 常见错误

混用 new[] 与 delete；对已释放地址再次 delete；复制 unique_ptr；在 vector 扩容后继续使用旧引用；把 map 当成允许重复键的 multimap。
将一个悬空指针置为 nullptr 不能修复指向同一对象的其他悬空指针。

## 易错题分析

题202：vector 支持高效随机访问。
题206、207：push_back 增加数量；map 的键唯一。
题228—230：数组分配要用 delete[]；unique_ptr 可移动不可复制；已释放对象不能再次访问。
