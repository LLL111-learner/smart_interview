# Java核心基础知识

---

## 一、面向对象三大特性

### 1. 封装（Encapsulation）
**概念说明**：将对象的属性和行为封装在一起，对外隐藏内部实现细节，仅通过公共接口访问。

**关键细节**：
- 使用访问修饰符控制可见性：private、default、protected、public
- getter/setter方法控制属性的读写
- 封装的好处：降低耦合、提高安全性、便于维护

**面试常见追问**：
- 四种访问修饰符的区别？作用范围分别是什么？
- 为什么推荐将成员变量设为private？
- JavaBean规范中封装的体现？

### 2. 继承（Inheritance）
**概念说明**：子类继承父类的属性和方法，实现代码复用和层次化设计。

**关键细节**：
- Java只支持单继承（类），但可以多实现（接口）
- 子类可以重写（Override）父类方法
- super关键字调用父类构造器和方法
- 构造器不能被继承，但子类构造器会隐式调用父类无参构造器

**面试常见追问**：
- 重写(Override)和重载(Overload)的区别？
- Java为什么不支持多继承？菱形继承问题？
- final关键字对继承的限制？

### 3. 多态（Polymorphism）
**概念说明**：同一引用类型在不同情况下表现出不同的行为。

**关键细节**：
- 编译时多态：方法重载
- 运行时多态：方法重写 + 向上转型
- 多态的三个必要条件：继承、重写、父类引用指向子类对象
- instanceof关键字判断类型

**面试常见追问**：
- 多态的实现原理（虚方法表）？
- 向上转型和向下转型？ClassCastException？
- 静态方法能实现多态吗？

---

## 二、String / StringBuilder / StringBuffer 区别

### String
**概念说明**：不可变字符串类，被final修饰，内部使用final char[]（JDK9改为byte[]）存储。

**关键细节**：
- String对象一旦创建，值不可修改（任何修改操作都会创建新对象）
- 字符串常量池：相同字面量的String共享同一个对象
- `String s = "abc"` 与 `String s = new String("abc")` 的区别：前者在常量池，后者在堆中
- String的intern()方法：将字符串放入常量池

### StringBuilder
**概念说明**：可变字符序列，线程不安全，性能高。

**关键细节**：
- 内部使用可变char数组存储，默认容量16
- 扩容规则：原容量*2+2
- 适用于单线程环境下的频繁字符串拼接

### StringBuffer
**概念说明**：可变字符序列，线程安全（方法加了synchronized），性能相对较低。

**关键细节**：
- API与StringBuilder几乎完全一致
- 适用于多线程环境下的字符串操作

**面试常见追问**：
- String为什么设计成不可变的？（安全性、缓存hash值、字符串池、线程安全）
- 字符串拼接"+"的底层实现？编译器优化？
- JDK9中String的底层变化（byte[]替代char[]）？

---

## 三、== 和 equals 区别

### ==运算符
- 基本类型：比较值是否相等
- 引用类型：比较内存地址（是否为同一个对象）

### equals()方法
- Object类中默认实现等同于==
- String、Integer等重写了equals()，比较的是值内容
- 自定义类需要根据业务需求重写equals()

### hashCode()与equals()的关系
- 约定：equals为true的两个对象，hashCode必须相同
- hashCode相同的两个对象，equals不一定为true
- 重写equals必须重写hashCode（HashMap依赖这个约定）

**面试常见追问**：
- Integer缓存池范围？`Integer a = 127; Integer b = 127; a == b`的结果？
- String常量池中equals和==的区别？
- 如何正确重写equals和hashCode方法？

---

## 四、HashMap底层原理（JDK8）

### 数据结构
数组 + 链表 + 红黑树

### 核心参数
- 默认初始容量：16
- 默认负载因子：0.75
- 链表转红黑树阈值：8（且数组长度>=64）
- 红黑树退化链表阈值：6

### put操作流程
1. 计算key的hash值：`(h = key.hashCode()) ^ (h >>> 16)` — 高16位异或低16位，减少碰撞
2. 根据hash值计算数组下标：`(n-1) & hash`
3. 若该位置为空，直接插入新节点
4. 若不为空，判断key是否相同（hash和equals），相同则覆盖value
5. 若为红黑树节点，走红黑树的插入逻辑
6. 若为链表，遍历链表：找到相同key则覆盖，否则尾插法插入（JDK7是头插法）
7. 插入后若链表长度>=8，转为红黑树
8. 若元素总数超过阈值（容量*负载因子），进行扩容（resize）

### 扩容机制
- 容量翻倍（2的幂次）
- 元素重新计算位置：原位置 或 原位置+旧容量
- JDK8扩容不会出现环形链表（尾插法）

**面试常见追问**：
- 为什么容量必须是2的幂次？
- JDK7中HashMap多线程死循环的原因？
- HashMap和Hashtable的区别？
- HashMap的key可以为null吗？

---

## 五、ConcurrentHashMap原理

### JDK7实现
- 分段锁（Segment）+ HashEntry数组
- 每个Segment是一个ReentrantLock
- 并发度等于Segment数量（默认16）

### JDK8实现
- 数组 + 链表 + 红黑树（与HashMap相同结构）
- 使用 CAS + synchronized 保证线程安全
- 锁粒度细化到每个数组槽位（Node）
- 扩容时多线程协助迁移

### 关键方法
- **put**：CAS尝试放入空槽位，非空则synchronized锁住头节点
- **get**：无锁读取，Node的val和next使用volatile修饰
- **size**：使用baseCount + CounterCell数组，类似LongAdder思想

**面试常见追问**：
- 为什么JDK8放弃了分段锁？
- ConcurrentHashMap能完全替代Hashtable吗？
- ConcurrentHashMap的key和value能为null吗？为什么？

---

## 六、ArrayList vs LinkedList

### ArrayList
- 底层：Object数组
- 随机访问：O(1)，支持RandomAccess接口
- 增删（中间位置）：O(n)，需要移动元素
- 扩容：默认10，每次扩容1.5倍（`oldCapacity + (oldCapacity >> 1)`）
- 内存：连续内存空间，CPU缓存友好

### LinkedList
- 底层：双向链表
- 随机访问：O(n)
- 增删（已知节点位置）：O(1)
- 额外内存开销：每个节点多存两个指针
- 实现了Deque接口，可作为双端队列/栈使用

**面试常见追问**：
- 实际开发中如何选择？（绝大多数场景ArrayList更优）
- ArrayList的modCount作用？（fail-fast机制）
- Vector和ArrayList的区别？

---

## 七、Java异常体系

### 层次结构
```
Throwable
├── Error（不可恢复的严重错误）
│   ├── OutOfMemoryError
│   ├── StackOverflowError
│   └── ...
└── Exception
    ├── RuntimeException（非受检异常）
    │   ├── NullPointerException
    │   ├── ArrayIndexOutOfBoundsException
    │   ├── ClassCastException
    │   ├── IllegalArgumentException
    │   └── ...
    └── 受检异常(Checked Exception)
        ├── IOException
        ├── SQLException
        ├── ClassNotFoundException
        └── ...
```

### 受检异常 vs 非受检异常
- **受检异常**：编译期检查，必须try-catch或throws声明
- **非受检异常**（RuntimeException及子类）：编译器不强制处理
- **Error**：系统级错误，不应该try-catch

### try-with-resources (JDK7+)
```java
try (InputStream is = new FileInputStream("file.txt")) {
    // 使用资源
} catch (IOException e) {
    // 处理异常
}
// 资源自动关闭，实现AutoCloseable接口即可
```

**面试常见追问**：
- finally块中的return会怎样？（会覆盖try中的return）
- throw和throws的区别？
- 自定义异常的最佳实践？

---

## 八、泛型、反射、注解

### 泛型（Generics）
**概念说明**：参数化类型，在编译期提供类型安全检查。

**关键细节**：
- 类型擦除：泛型信息在编译后被擦除，运行时无法获取泛型的实际类型
- 通配符：`?`表示未知类型
  - `<? extends T>`：上界通配符，只能读不能写（生产者）
  - `<? super T>`：下界通配符，只能写不能读（消费者）
  - PECS原则：Producer Extends, Consumer Super
- 泛型方法、泛型类、泛型接口
- 不能创建泛型数组：`new T[]` 非法

### 反射（Reflection）
**概念说明**：在运行时动态获取类的信息、创建对象、调用方法。

**关键细节**：
- 获取Class对象的三种方式：`Class.forName()`、`对象.getClass()`、`类名.class`
- 核心API：Constructor、Method、Field
- 可以突破访问控制（setAccessible(true)）
- 框架大量使用反射：Spring IOC、MyBatis、JSON序列化

**性能优化**：
- 缓存反射结果（Method、Field对象）
- 使用MethodHandle（JDK7+）
- 使用字节码生成技术（如CGLIB）

### 注解（Annotation）
**概念说明**：元数据，为代码提供额外信息，可被编译器或运行时处理。

**关键细节**：
- 元注解：@Target、@Retention、@Documented、@Inherited
- @Retention策略：SOURCE（编译丢弃）、CLASS（字节码保留）、RUNTIME（运行时可反射获取）
- 内置注解：@Override、@Deprecated、@SuppressWarnings、@FunctionalInterface
- 自定义注解 + 反射实现框架功能

**面试常见追问**：
- 泛型擦除后如何获取泛型类型信息？（通过反射获取ParameterizedType）
- Spring中注解是如何生效的？
- APT（注解处理器）的工作原理？

---

> **使用建议**：本文档覆盖Java后端面试中最核心的基础知识点，每个知识点的"追问方向"可帮助候选人进行深度准备。建议结合实际代码示例理解，而非死记硬背。
