# 类与对象、继承与多态

课程：C++
知识点：类与对象、继承与多态

## 核心概念

类封装数据和操作。class 成员默认 private，struct 成员默认 public。构造函数负责对象初始化，没有返回类型；建议用成员初始化列表初始化数据成员。
const 成员函数不能通过 this 修改非 mutable 的非静态数据成员。局部变量仍可修改，mutable 成员用于需要在逻辑常量操作中更新的内部状态。
基类虚函数允许通过基类指针或引用动态派发到派生类的重写实现。override 让编译器检查重写关系，能发现参数类型或 const 限定不匹配。
若允许通过基类指针 delete 派生类对象，基类应具有可访问的虚析构函数。非虚析构的普通基类不适合用于这种多态删除。

## C++代码示例

```cpp
#include <cassert>
#include <memory>
class Shape {
public:
    virtual int area() const = 0;
    virtual ~Shape() = default;
};
class Square : public Shape {
    int side;
public:
    explicit Square(int n) : side(n) {}
    int area() const override { return side * side; }
};
int main() {
    std::unique_ptr<Shape> shape = std::make_unique<Square>(3);
    assert(shape->area() == 9);
} // 通过虚析构正确销毁派生对象
```

## 常见错误

把构造函数写成带返回类型的普通函数；把重写误写为不同签名的新函数；按值传递基类造成对象切片；以为所有成员函数都会自动动态派发。
上例假设边长为小正整数，生产代码应检查输入和乘法溢出。

## 易错题分析

题203：多态删除关注虚析构函数。
题208、209：动态派发依赖虚函数；override 用于编译期检查，不会使普通函数自动成为合法重写。
题225—227：class 默认 private；构造函数初始化对象；const 成员函数不能直接修改普通数据成员。
