# Vue与React专题知识

---

# 第一部分：Vue

---

## 一、响应式原理

### Vue2 响应式（Object.defineProperty）
**核心流程**：
1. **Observer**：递归遍历data中所有属性，使用`Object.defineProperty`为每个属性定义getter和setter
2. **Dep（依赖管理器）**：每个响应式属性都有一个Dep实例，存储所有依赖该属性的Watcher
3. **Watcher（观察者）**：组件渲染时创建Watcher，读取数据触发getter，Watcher被添加到Dep中
4. **触发更新**：数据变化触发setter → 通知Dep → Dep通知所有Watcher → Watcher触发组件重新渲染

**局限性**：
- 无法检测对象属性的新增和删除（需要Vue.set / Vue.delete）
- 无法检测数组索引赋值和长度修改（Vue重写了7个数组方法：push/pop/shift/unshift/splice/sort/reverse）
- 深层嵌套对象需要递归遍历，初始化性能消耗大

### Vue3 响应式（Proxy）
**核心改进**：
- 使用`Proxy`代理整个对象，可以拦截所有操作（get/set/deleteProperty/has等）
- 可以检测属性新增、删除
- 可以检测数组索引和length变化
- 惰性响应式：只有访问到的嵌套对象才会被代理（提升性能）

**核心API**：
```javascript
// reactive - 深层响应式，返回Proxy代理
const state = reactive({ count: 0, nested: { value: 1 } })

// ref - 基本类型响应式，通过.value访问
const count = ref(0)
count.value++

// computed - 计算属性，有缓存
const double = computed(() => count.value * 2)

// watch / watchEffect - 监听变化
watch(() => state.count, (newVal, oldVal) => { /* ... */ })
watchEffect(() => { console.log(state.count) }) // 自动收集依赖
```

**ref vs reactive**：
- ref：基本类型 + 对象均可，需要.value访问，可以整体替换
- reactive：仅对象类型，直接访问属性，解构会丢失响应式（需要toRefs）

---

## 二、虚拟DOM与Diff算法

### 虚拟DOM
- 用JS对象描述真实DOM节点的树结构
- 渲染流程：Template → render函数 → VNode → 真实DOM
- 优势：跨平台、批量更新减少DOM操作、结合diff算法实现最小更新

### Vue的Diff算法
**核心策略**：同层比较，不跨层
- 只比较同一层级的节点（O(n)复杂度）
- 使用key标识节点，快速判断是否可复用

**Vue2 双端比较**：
1. 新旧列表各有头尾两个指针（4个指针）
2. 每轮比较4种组合：旧头-新头、旧尾-新尾、旧头-新尾、旧尾-新头
3. 匹配到则移动指针并复用节点
4. 都不匹配则用新节点的key在旧列表中查找

**Vue3 优化（最长递增子序列）**：
1. 先处理头部和尾部相同的节点（预处理）
2. 对中间乱序部分使用最长递增子序列算法，找出不需要移动的节点
3. 减少不必要的DOM移动操作

### key的作用
- 唯一标识VNode，帮助diff算法判断节点是否可复用
- 不使用key时，Vue使用"就地复用"策略，可能导致状态错乱
- 不要使用index作为key（列表有增删时会导致错误复用）

---

## 三、组件通信方式

| 方式 | 方向 | Vue2 | Vue3 |
|------|------|------|------|
| props / emit | 父→子 / 子→父 | 支持 | 支持 |
| provide / inject | 祖先→后代 | 支持 | 支持（可响应式） |
| EventBus | 任意组件 | 支持 | 需第三方（mitt） |
| Vuex / Pinia | 全局 | Vuex | Pinia（推荐） |
| $refs | 父→子 | 支持 | 支持 |
| $attrs | 祖先→后代 | 支持 | 支持（合并$listeners） |
| v-model | 父↔子 | .sync修饰符 | 支持多个v-model |
| 插槽（slot） | 父→子 | 支持 | 支持 |
| expose / defineExpose | 子→父 | 不支持 | 支持 |

---

## 四、Vuex / Pinia 状态管理

### Vuex（Vue2主流）
**核心概念**：
- **State**：单一状态树（唯一数据源）
- **Getter**：从State派生状态（类似计算属性）
- **Mutation**：同步修改State的唯一方式
- **Action**：异步操作，提交Mutation
- **Module**：模块化拆分

**数据流**：组件 → dispatch Action → commit Mutation → 修改State → 响应式更新组件

### Pinia（Vue3推荐）
**优势对比Vuex**：
- 去掉了Mutation，Action可以直接修改State
- 完整的TypeScript支持
- 不需要嵌套模块，每个Store都是扁平结构
- 体积更小（约1KB）
- 支持组合式API（Setup Store）

```javascript
// 定义Store
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)
  function increment() { count.value++ }
  return { count, doubleCount, increment }
})

// 使用Store
const counter = useCounterStore()
counter.increment()
```

---

## 五、Vue Router 原理

### 两种模式
**Hash模式**：
- URL中带#号：`http://example.com/#/about`
- 监听 `hashchange` 事件
- 不需要服务器配置
- SEO不友好

**History模式**：
- URL正常格式：`http://example.com/about`
- 使用 `history.pushState()` 和 `popstate` 事件
- 需要服务器配置所有路由返回index.html（避免404）
- SEO相对友好

### 导航守卫
```javascript
// 全局前置守卫（常用于权限控制）
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

// 路由独享守卫
{ path: '/admin', beforeEnter: (to, from, next) => { /* ... */ } }

// 组件内守卫
onBeforeRouteEnter / onBeforeRouteUpdate / onBeforeRouteLeave
```

### 路由懒加载
```javascript
const routes = [
  { path: '/about', component: () => import('./views/About.vue') }
]
```

---

# 第二部分：React

---

## 六、JSX原理

### 本质
JSX是JavaScript的语法扩展，编译后转化为React.createElement()调用（React17+可自动引入jsx-runtime，不需要显式导入React）。

```jsx
// JSX
<div className="box">
  <h1>Hello</h1>
</div>

// 编译后
React.createElement('div', { className: 'box' },
  React.createElement('h1', null, 'Hello')
)
```

### 与HTML的区别
- 使用className代替class
- 使用htmlFor代替for
- 样式使用驼峰式对象：`style={{ fontSize: '16px' }}`
- 事件使用驼峰命名：onClick、onChange
- 必须有根元素（可用Fragment `<></>`）
- 可以嵌入JS表达式（花括号`{}`）

---

## 七、虚拟DOM与Fiber

### React虚拟DOM
- createElement返回React Element（JS对象描述DOM）
- 通过Reconciler（协调器）进行新旧虚拟DOM对比
- 找出差异后由Renderer（渲染器）更新真实DOM

### Fiber架构（React 16+）
**背景**：React 15使用递归方式（Stack Reconciler）进行Diff，大型组件树更新时会长时间占用主线程，导致页面卡顿。

**核心思想**：
- 将递归遍历改为基于链表的迭代遍历
- 每个Fiber节点是一个工作单元，包含：type、props、stateNode、child、sibling、return
- 可中断渲染：每完成一个Fiber节点的处理就检查是否有更高优先级的任务
- 时间切片（Time Slicing）：利用requestIdleCallback（或自实现）在浏览器空闲时间执行渲染

**两个阶段**：
- **Render阶段（可中断）**：构建Fiber树、Diff对比、标记副作用。在内存中完成，不会操作DOM
- **Commit阶段（不可中断）**：执行DOM更新、调用生命周期钩子、执行副作用

### Diff策略
1. **树级别**：只比较同层，不同类型直接替换整棵子树
2. **组件级别**：相同类型组件更新props，不同类型直接卸载重建
3. **元素级别**：通过key判断是否可复用

---

## 八、Hooks原理

### 核心原理
- Hooks以链表形式存储在Fiber节点的memoizedState属性上
- 每次渲染按顺序遍历链表，所以Hooks不能在条件/循环中使用（否则链表顺序错乱）
- 每个Hook节点存储：memoizedState（状态值）、queue（更新队列）、next（下一个Hook）

### 常用Hooks

**useState**：
```jsx
const [count, setCount] = useState(0)
// 函数式更新（基于上一次state）
setCount(prev => prev + 1)
```

**useEffect**：
```jsx
// 相当于componentDidMount + componentDidUpdate
useEffect(() => {
  // 副作用逻辑
  return () => { /* 清理函数（组件卸载或依赖变化前执行） */ }
}, [deps]) // 依赖数组
```

**useCallback / useMemo**：
```jsx
// 缓存函数引用，避免子组件不必要的重渲染
const handleClick = useCallback(() => { /* ... */ }, [deps])

// 缓存计算结果
const expensiveValue = useMemo(() => computeExpensive(a, b), [a, b])
```

**useRef**：
```jsx
const inputRef = useRef(null)
// 获取DOM元素：inputRef.current
// 也可存储可变值（不触发重渲染）
```

### 闭包陷阱
```jsx
function Counter() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      // 这里的count永远是0（闭包捕获了初始值）
      console.log(count) // 始终是0
    }, 1000)
    return () => clearInterval(timer)
  }, []) // 空依赖，只执行一次

  // 解决方案1：添加count到依赖数组
  // 解决方案2：使用函数式更新 setCount(c => c + 1)
  // 解决方案3：使用useRef保存最新值
}
```

---

## 九、Redux / Context

### Context API
**适用场景**：跨层级传递不频繁变化的数据（主题、语言、用户信息）

```jsx
const ThemeContext = createContext('light')

// 提供者
<ThemeContext.Provider value={theme}>
  <App />
</ThemeContext.Provider>

// 消费者
const theme = useContext(ThemeContext)
```

**性能问题**：Provider的value变化时，所有消费者都会重渲染（即使消费的部分没有变化）。可以通过拆分Context、使用memo/useMemo优化。

### Redux
**核心概念**：
- **Store**：全局唯一的状态存储
- **Action**：描述发生了什么（{ type: 'ADD_TODO', payload: {...} }）
- **Reducer**：纯函数，接收旧state和action，返回新state
- **Dispatch**：分发action触发state更新

**Redux Toolkit（推荐写法）**：
```javascript
import { createSlice, configureStore } from '@reduxjs/toolkit'

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: state => { state.value += 1 }, // immer支持"可变"写法
    decrement: state => { state.value -= 1 },
    addAmount: (state, action) => { state.value += action.payload }
  }
})

const store = configureStore({ reducer: { counter: counterSlice.reducer } })
```

### Context vs Redux
| 维度 | Context | Redux |
|------|---------|-------|
| 适用场景 | 简单的全局状态 | 复杂的全局状态 |
| 性能 | Provider值变化全部重渲染 | 精细化订阅，按需更新 |
| 调试 | 无开发者工具 | Redux DevTools |
| 中间件 | 无 | 支持（thunk、saga等） |
| 学习成本 | 低 | 中等 |

---

## 十、React Router

### 核心组件
```jsx
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/user/:id" element={<User />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

// 编程式导航
const navigate = useNavigate()
navigate('/about')

// 获取路由参数
const { id } = useParams()
```

### 路由懒加载
```jsx
import { lazy, Suspense } from 'react'
const About = lazy(() => import('./pages/About'))

<Suspense fallback={<Loading />}>
  <Route path="/about" element={<About />} />
</Suspense>
```

---

> **使用建议**：Vue和React是前端面试的重中之重。Vue面试侧重响应式原理和生命周期，React面试侧重Hooks和Fiber架构。建议两个框架都要了解原理层面的差异，而非仅停留在API使用层面。
