# HTML/CSS/JavaScript 基础知识

---

## 一、HTML5新特性

### 语义化标签
| 标签 | 说明 |
|------|------|
| `<header>` | 页面或区块的头部 |
| `<nav>` | 导航链接区域 |
| `<main>` | 页面主要内容（唯一） |
| `<section>` | 文档中的章节 |
| `<article>` | 独立的文章内容 |
| `<aside>` | 侧边栏/辅助内容 |
| `<footer>` | 页面或区块的底部 |
| `<figure>/<figcaption>` | 图片/图表及其标题 |

### 新增API和功能
- **Canvas/SVG**：图形绘制
- **音视频**：`<audio>` 和 `<video>` 标签
- **地理定位**：Geolocation API
- **本地存储**：localStorage / sessionStorage
- **WebSocket**：全双工通信
- **Web Worker**：多线程支持
- **拖拽API**：Drag and Drop
- **表单增强**：新增input类型（email、date、range等）和属性（placeholder、required、pattern）

---

## 二、CSS布局

### Flex布局
**容器属性**：
| 属性 | 说明 | 常用值 |
|------|------|--------|
| display | 定义弹性容器 | flex / inline-flex |
| flex-direction | 主轴方向 | row / column / row-reverse / column-reverse |
| justify-content | 主轴对齐 | flex-start / center / space-between / space-around / space-evenly |
| align-items | 交叉轴对齐 | flex-start / center / stretch / baseline |
| flex-wrap | 是否换行 | nowrap / wrap |
| gap | 元素间距 | 10px |

**项目属性**：
| 属性 | 说明 |
|------|------|
| flex-grow | 放大比例（默认0，不放大） |
| flex-shrink | 缩小比例（默认1，空间不足时缩小） |
| flex-basis | 初始大小（默认auto） |
| flex | 简写（常用：flex: 1 等价于 1 1 0%） |
| align-self | 单独设置交叉轴对齐 |
| order | 排列顺序 |

**经典布局**：
```css
/* 水平垂直居中 */
.parent {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 两栏布局：左固定右自适应 */
.container { display: flex; }
.left { width: 200px; }
.right { flex: 1; }
```

### Grid布局
```css
.container {
  display: grid;
  grid-template-columns: 200px 1fr 200px; /* 三列 */
  grid-template-rows: auto 1fr auto;       /* 三行 */
  gap: 10px;
}

/* 子元素跨列 */
.item { grid-column: 1 / 3; }
```

**Flex vs Grid**：
- Flex：一维布局（行或列），适合导航栏、工具栏等
- Grid：二维布局（行和列同时控制），适合整体页面布局、复杂网格

---

## 三、BFC（Block Formatting Context）

### 概念
BFC是一个独立的渲染区域，内部元素的布局不会影响外部元素。

### 触发条件
- `overflow` 不为 visible（如 overflow: hidden/auto/scroll）
- `display` 为 inline-block / flex / grid / table-cell
- `float` 不为 none
- `position` 为 absolute 或 fixed
- 根元素 `<html>`

### 应用场景
1. **清除浮动**：父元素触发BFC可以包含浮动子元素
2. **防止margin重叠**：两个相邻BFC的margin不会合并
3. **自适应两栏布局**：BFC区域不会与浮动元素重叠

---

## 四、CSS选择器优先级

### 优先级权重计算
| 选择器类型 | 权重 | 示例 |
|-----------|------|------|
| !important | 最高 | color: red !important |
| 内联样式 | 1000 | style="color: red" |
| ID选择器 | 100 | #header |
| 类/伪类/属性选择器 | 10 | .box / :hover / [type] |
| 标签/伪元素选择器 | 1 | div / ::before |
| 通配符/组合符 | 0 | * / > / + |

### 规则
- 权重相同时，后定义的优先
- 继承的样式权重最低
- !important > 内联 > ID > 类 > 标签
- 尽量避免使用!important，会导致样式难以维护

---

## 五、JS数据类型与类型转换

### 数据类型（8种）
**基本类型（7种）**：
- Number、String、Boolean、undefined、null、Symbol（ES6）、BigInt（ES2020）

**引用类型（1种）**：
- Object（包含Array、Function、Date、RegExp、Map、Set等）

### 类型判断
| 方法 | 适用场景 | 局限 |
|------|---------|------|
| typeof | 基本类型 | null返回"object"，数组返回"object" |
| instanceof | 判断原型链 | 不能判断基本类型，跨iframe失效 |
| Object.prototype.toString.call() | 所有类型 | 最可靠 |
| Array.isArray() | 判断数组 | 只能判断数组 |

### 类型转换
**隐式转换规则**：
- `+` 运算：有字符串则转字符串拼接
- `-` `*` `/` 运算：转数字
- `==` 比较：会类型转换（`===` 不会）
- `if` 条件：转布尔值

**假值（Falsy）**：`false`、`0`、`""`、`null`、`undefined`、`NaN`

---

## 六、原型与原型链

### 核心概念
- 每个函数都有 `prototype` 属性，指向原型对象
- 每个对象都有 `__proto__` 属性（即 `[[Prototype]]`），指向其构造函数的 `prototype`
- 原型对象的 `constructor` 指回构造函数

### 原型链
```
实例.__proto__ → 构造函数.prototype.__proto__ → Object.prototype.__proto__ → null
```

当访问对象的属性时，先在自身查找，找不到则沿原型链向上查找，直到Object.prototype，仍找不到返回undefined。

### 继承实现方式
1. **原型链继承**：`Child.prototype = new Parent()` — 缺点：共享引用类型属性
2. **构造函数继承**：在子类中 `Parent.call(this)` — 缺点：无法继承原型方法
3. **组合继承**：原型链+构造函数 — 缺点：父类构造函数调用两次
4. **寄生组合继承**：`Child.prototype = Object.create(Parent.prototype)` — 最优方案
5. **ES6 class**：`class Child extends Parent` — 语法糖，底层仍是寄生组合继承

---

## 七、闭包

### 概念
闭包是指一个函数能够访问其外部函数作用域中的变量，即使外部函数已经执行完毕。本质上是函数和其词法环境的组合。

### 形成条件
1. 函数嵌套
2. 内部函数引用外部函数的变量
3. 内部函数被外部引用（返回或传递）

### 应用场景
```javascript
// 1. 模块模式（封装私有变量）
function createCounter() {
  let count = 0;
  return {
    increment: () => ++count,
    getCount: () => count
  };
}

// 2. 柯里化
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
}

// 3. 防抖
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

### 注意事项
- **内存泄漏**：闭包持有的变量不会被GC回收，使用后应及时释放（置为null）
- **性能影响**：过度使用闭包会增加内存消耗
- **循环中的闭包**：经典问题，for循环中的var + setTimeout

---

## 八、this指向

### 绑定规则（优先级从高到低）
1. **new绑定**：`new Fn()` → this指向新创建的对象
2. **显式绑定**：`call/apply/bind` → this指向指定的对象
3. **隐式绑定**：`obj.fn()` → this指向调用者obj
4. **默认绑定**：独立调用 → 严格模式undefined，非严格模式window

### 特殊情况
- **箭头函数**：没有自己的this，继承外层作用域的this，call/apply/bind无法改变
- **事件处理**：DOM事件中this指向绑定的元素
- **回调函数**：this通常指向window（除非绑定）

---

## 九、事件循环（Event Loop）

### 浏览器中的Event Loop
```
执行同步代码（调用栈）
    ↓
检查微任务队列，全部执行
    ↓
取一个宏任务执行
    ↓
检查微任务队列，全部执行
    ↓
渲染更新（如果需要）
    ↓
重复以上过程
```

### 任务分类
**宏任务（Macro Task）**：
- setTimeout / setInterval
- setImmediate（Node.js）
- I/O操作
- UI渲染
- requestAnimationFrame

**微任务（Micro Task）**：
- Promise.then / catch / finally
- MutationObserver
- queueMicrotask()
- process.nextTick（Node.js，优先级最高）

### 经典面试题
```javascript
console.log('1');               // 同步
setTimeout(() => console.log('2'), 0);  // 宏任务
Promise.resolve().then(() => console.log('3'));  // 微任务
console.log('4');               // 同步
// 输出顺序：1 → 4 → 3 → 2
```

---

## 十、Promise / async-await

### Promise
**三种状态**：pending（等待）→ fulfilled（成功）/ rejected（失败），状态不可逆。

**核心方法**：
| 方法 | 说明 |
|------|------|
| then(onFulfilled, onRejected) | 处理成功和失败 |
| catch(onRejected) | 捕获错误（等价于then(null, onRejected)） |
| finally(callback) | 无论成功失败都执行 |
| Promise.all([]) | 全部成功才成功，一个失败就失败 |
| Promise.allSettled([]) | 等待全部完成，返回每个结果 |
| Promise.race([]) | 返回最先完成（成功或失败）的结果 |
| Promise.any([]) | 返回最先成功的结果 |

### async/await
- async函数返回一个Promise
- await后面跟Promise，会暂停async函数执行，等待Promise解决
- 本质是Generator + 自动执行器的语法糖
- 错误处理使用try/catch

```javascript
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('请求失败:', error);
  }
}
```

### 常见陷阱
- 循环中使用await：`for...of`可以串行执行，`forEach`中的await不会等待
- 并行请求应使用`Promise.all`而非多个await顺序执行
- async函数中未捕获的reject会变成unhandledrejection

---

> **使用建议**：前端基础知识覆盖面广，建议候选人在理解概念的基础上多写代码实践，特别是闭包、原型链、事件循环等核心概念需要通过实际示例加深理解。
