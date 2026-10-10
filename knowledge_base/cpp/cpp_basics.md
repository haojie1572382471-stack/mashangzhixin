# C++ 基础知识

课程：C++
知识点：变量、数据类型、const、函数、值传递、引用传递、作用域

## 变量

变量是程序中用于保存数据的命名存储空间。变量在使用前需要声明，并根据数据的含义选择合适的数据类型。

变量示例：

    int age = 20;
    double score = 95.5;
    char grade = 'A';
    bool passed = true;

## 常用数据类型

C++ 常用的数据类型包括：

1. int：用于保存整数。
2. long long：用于保存范围更大的整数。
3. float：用于保存单精度浮点数。
4. double：用于保存双精度浮点数。
5. char：用于保存单个字符。
6. bool：用于保存 true 或 false。
7. std::string：用于保存字符串。

选择数据类型时，需要考虑数据的取值范围、精度和内存占用。

## const 常量

const 用于表示对象的值不能通过该对象进行修改。

使用 const 可以防止程序意外修改重要数据，也可以让代码的含义更加清楚。

示例：

    const double pi = 3.14159;
    const int maxStudents = 50;

上面的 pi 和 maxStudents 初始化以后不能再次赋值。

## 函数

函数是完成特定任务的一段可复用代码。函数可以接收参数，也可以返回计算结果。

示例：

    int add(int left, int right) {
        return left + right;
    }

    int result = add(10, 20);

没有返回值的函数使用 void 作为返回值类型。

## 值传递

值传递会复制实参的值。函数内部修改形参时，不会改变函数外部的原变量。

示例：

    void changeCopy(int value) {
        value = 100;
    }

## 引用传递

引用传递让形参成为原变量的别名，因此函数内部可以直接修改原变量。

示例：

    void increase(int& value) {
        value++;
    }

如果函数只需要读取较大的对象而不需要修改，可以使用常量引用。

示例：

    void printName(const std::string& name) {
        std::cout << name;
    }

## 作用域

作用域决定变量能够被访问的位置。

1. 局部变量只在声明它的函数或代码块内部有效。
2. 全局变量定义在函数外部，可以被多个函数访问。
3. 代码块内部声明的同名变量可能遮蔽外层变量。

通常应尽量缩小变量的作用域，避免使用过多全局变量。

## 自动类型推导

auto 可以让编译器根据初始化表达式自动推导变量类型。

示例：

    auto count = 10;
    auto price = 19.9;

count 会被推导为 int，price 会被推导为 double。

来源：码上知新项目 C++ 基础知识库。