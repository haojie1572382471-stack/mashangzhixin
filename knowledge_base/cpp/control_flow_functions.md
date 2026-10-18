# 条件与循环、函数

课程：C++
知识点：变量与数据类型、运算符与表达式、条件与循环、函数

## 核心概念

bool 保存 true 或 false。const 对象初始化后不能通过该变量再次赋值。auto 根据初始化表达式推导类型，例如 auto x=3.5 推导为 double。
整数除法 7/2 的结果是 3，乘法优先于加法，因此 2+3*4 为 14。内置逻辑与 && 和逻辑或 || 支持短路求值，短路时右操作数不执行。
if 根据条件选择分支。for 依次执行初始化、条件检查、循环体、更新表达式。continue 跳过本轮剩余语句，for 仍会执行更新表达式；break 退出最内层循环或 switch。
switch 的 case 默认允许贯穿，若不需要贯穿应使用 break；有意贯穿可写 [[fallthrough]] 表达意图。
函数值传递复制实参，引用传递可以修改实参。普通函数不能仅凭返回类型不同构成重载。

## C++代码示例

```cpp
#include <cassert>
void by_value(int x) { x = 9; }
void by_reference(int& x) { x = 9; }
int main() {
    int a = 1;
    by_value(a);
    assert(a == 1);
    by_reference(a);
    assert(a == 9);
    int sum = 0;
    for (int i = 0; i < 4; ++i) {
        if (i == 2) continue;
        sum += i;
    }
    assert(sum == 4); // 0 + 1 + 3
    int x = 0;
    bool result = false && (++x > 0);
    assert(!result && x == 0);
}
```

## 常见错误

把 = 当成 ==；误以为整数除法自动产生浮点结果；把 continue 当成 break；忘记 switch 的贯穿行为；以为值参数的修改会影响原变量。
不要用存在未定义行为的表达式练习运算符优先级。需要小数结果时，可先将除数或被除数转换为 double。

## 易错题分析

题210—212：区分 bool、const 和 auto 类型推导。
题213—215：先判断操作数类型，再分析优先级和短路；false && (++x>0) 不改变 x。
题216—218：i<3 对 i=0、1、2 成立，循环3次；continue 仍执行 for 的更新表达式。
题219—221：值传递只改副本；int& 引用参数修改原对象；返回类型不能单独决定重载。
