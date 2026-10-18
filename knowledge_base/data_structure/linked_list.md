# 链表

课程：数据结构
知识点：链表

## 核心概念

单链表结点保存数据及后继指针 next，尾结点的 next 为空。访问第 k 个结点需要沿链遍历，通常为 O(k)；若已知前驱，在其后插入或删除一个结点只需常数次指针修改。
插入结点 s 到 p 后面，应先 s->next=p->next，再 p->next=s。逆序修改会丢失原后继或构造自环。
删除 p 后面的 q 时，先保存或连接 q 的后继，再释放 q。new 创建的独立结点用 delete 释放，释放后不能再读取 q->next。
若要删除头结点，必须更新头指针；哨兵结点可以统一边界处理，但需明确哨兵本身是否计入有效元素。

## C++代码示例

```cpp
#include <cassert>
struct Node { int value; Node* next; };
int main() {
    Node* head = new Node{1, nullptr};
    Node* s = new Node{2, nullptr};
    s->next = head->next;
    head->next = s;
    assert(head->next->value == 2);
    Node* q = head->next;
    head->next = q->next;
    delete q;
    assert(head->next == nullptr);
    delete head;
    head = nullptr;
}
```

## 常见错误

在检查指针是否为空之前访问成员；释放结点后读取 next；只把局部指针设为 nullptr 却没有连接前驱和后继；误认为链表的任意位置访问都是 O(1)。
上例用于展示指针连接顺序，实际工程应结合智能指针或标准容器管理异常路径上的资源。

## 易错题分析

题116：先连接新结点的 next，再修改前驱的 next。
题117：链表按序访问，不能用地址二分实现下标访问。
题118：p->next=q->next 必须在 delete q 前执行。
