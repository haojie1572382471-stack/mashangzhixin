# STL容器、动态内存

课程：C++
知识点：STL容器、动态内存

来源：码上知新课程知识库

## 核心概念

std::vector 使用连续存储，支持 O(1) 下标随机访问。push_back 增加 size；扩容可能使已有指针、引用和迭代器失效。reserve 调整容量预留，不直接增加元素数量。
std::map 的键按比较器定义的等价关系保持唯一；通常支持 O(log n) 查找。std::list 不支持常数时间下标访问。
new 与 delete 配对，new[] 与 delete[] 配对。对象销毁后，指向它的旧指针成为悬空指针，不能解引用或再次释放。
RAII 让资源生命周期跟随对象生命周期。std::unique_ptr 表示独占所有权，不可复制，可通过移动转移；std::make_unique 可以避免手写配对释放。

vector 和 list 的选择取决于访问模式。vector 随机访问快、连续存储利于缓存；list 适合在已知迭代器位置频繁插入删除，但查找位置仍可能 O(n)，并有结点和指针开销。std::set 保存按比较器排序的唯一键，map 保存唯一键到值的映射，二者通常查找 O(log n)。迭代器表示容器中的位置，end 是尾后位置，不可解引用。list 插入通常不使已有迭代器失效，删除使被删元素的迭代器失效；vector 的失效规则要结合扩容和修改位置判断。

## 代码示例

下面示例使用 C++17，可独立保存为 .cpp 文件编译运行。assert 检查关键结果；阅读时先预测输出状态，再运行验证。

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

## 常见错误：new 与 delete 的资源管理

new 和 delete 使用错误会造成内存泄漏、重复释放或释放后使用问题。遗漏 delete 会泄漏资源，重复 delete 与解引用已释放对象都会引发未定义行为；这类问题可能表现为崩溃或数据损坏，也可能暂时没有可见症状。应优先让容器或 RAII 对象承担所有权，而不是仅依赖手工检查每个返回分支。


混用 new[] 与 delete；对已释放地址再次 delete；复制 unique_ptr；在 vector 扩容后继续使用旧引用；把 map 当成允许重复键的 multimap。
将一个悬空指针置为 nullptr 不能修复指向同一对象的其他悬空指针。

RAII 不只管理内存，也适合文件、锁等资源：构造时获取，析构时释放，即使异常离开作用域也执行清理。new/delete 使用错误常造成内存泄漏、重复释放和释放后使用；new[] 必须与 delete[] 配对，不能用 free 释放 new 分配的对象。容器遍历中删除元素应使用容器 erase 的返回值或遵循对应失效规则，不要先删除再递增已失效迭代器。set 的键不能通过迭代器直接修改，否则会破坏有序性。

## 易错题分析

题202：vector 支持高效随机访问。
题206、207：push_back 增加数量；map 的键唯一。
题228—230：数组分配要用 delete[]；unique_ptr 可移动不可复制；已释放对象不能再次访问。

分析 STL 题先确定操作要求：频繁按下标访问通常选 vector，维护唯一有序键可选 set，需要键值映射可选 map，不要把 list 的插入优势忽略定位成本。分析 new/delete 题分别记录分配形式、所有者及释放点；发生异常或提前 return 时也必须释放资源。unique_ptr 的移动转移所有权，移出对象不再拥有原资源；shared_ptr 的循环强引用需要额外设计，不能认为智能指针能自动修复所有所有权错误。
