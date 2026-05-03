# SpringBoot专题知识

---

## 一、Spring IOC 原理

### 概念
IOC（Inversion of Control，控制反转）是Spring的核心思想，将对象的创建和依赖关系的管理交给Spring容器，而不是由程序员手动new对象。

### 实现方式
- **依赖注入（DI）**：通过构造器注入、Setter注入、字段注入（@Autowired）
- **BeanFactory**：IOC容器的底层接口，提供延迟加载
- **ApplicationContext**：BeanFactory的扩展，提供更多企业级功能（事件发布、国际化、AOP集成等），启动时预实例化单例Bean

### 容器启动流程
1. 加载配置（XML/注解/JavaConfig）
2. 解析BeanDefinition（Bean的元信息）
3. 注册BeanDefinition到BeanDefinitionRegistry
4. 实例化Bean（反射创建对象）
5. 属性填充（依赖注入）
6. 初始化（调用初始化方法）
7. 放入容器（单例池singletonObjects）

### 三级缓存解决循环依赖
```
一级缓存 singletonObjects      - 完整的Bean对象
二级缓存 earlySingletonObjects  - 提前暴露的Bean（可能被AOP代理）
三级缓存 singletonFactories     - Bean的ObjectFactory（延迟创建代理）
```

**循环依赖解决过程**（A依赖B，B依赖A）：
1. 创建A，将A的ObjectFactory放入三级缓存
2. A填充属性，发现需要B
3. 创建B，将B的ObjectFactory放入三级缓存
4. B填充属性，发现需要A
5. 从三级缓存获取A的ObjectFactory，创建A的早期引用放入二级缓存
6. B完成初始化，放入一级缓存
7. A获取到B，完成初始化，放入一级缓存

**注意**：构造器注入的循环依赖无法解决（可使用@Lazy延迟加载）

---

## 二、Bean生命周期

### 完整生命周期（关键步骤）
1. **实例化**（Instantiation）：通过反射创建Bean实例
2. **属性填充**（Population）：注入依赖的Bean和属性值
3. **Aware接口回调**：
   - BeanNameAware → setBeanName()
   - BeanFactoryAware → setBeanFactory()
   - ApplicationContextAware → setApplicationContext()
4. **BeanPostProcessor前置处理**：postProcessBeforeInitialization()
5. **初始化**：
   - @PostConstruct 注解方法
   - InitializingBean → afterPropertiesSet()
   - 自定义 init-method
6. **BeanPostProcessor后置处理**：postProcessAfterInitialization()（AOP代理在此创建）
7. **使用Bean**
8. **销毁**：
   - @PreDestroy 注解方法
   - DisposableBean → destroy()
   - 自定义 destroy-method

### Bean作用域
| 作用域 | 说明 |
|--------|------|
| singleton | 默认，容器中只有一个实例 |
| prototype | 每次获取创建新实例 |
| request | 每个HTTP请求一个实例（Web环境） |
| session | 每个HTTP会话一个实例（Web环境） |

---

## 三、SpringBoot自动配置原理

### @SpringBootApplication
该注解是一个组合注解，包含：
- **@SpringBootConfiguration**：标记为配置类（等价于@Configuration）
- **@EnableAutoConfiguration**：开启自动配置
- **@ComponentScan**：组件扫描（扫描主类所在包及子包）

### 自动配置核心流程
1. `@EnableAutoConfiguration` 通过 `@Import(AutoConfigurationImportSelector.class)` 导入自动配置选择器
2. `AutoConfigurationImportSelector` 调用 `SpringFactoriesLoader.loadFactoryNames()`
3. 读取所有jar包下的 `META-INF/spring.factories`（SpringBoot 2.7+改为`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`）
4. 获取所有自动配置类的全限定名
5. 通过条件注解过滤，只加载满足条件的配置类

### 条件注解（@Conditional系列）
| 注解 | 条件 |
|------|------|
| @ConditionalOnClass | 类路径下存在指定类 |
| @ConditionalOnMissingClass | 类路径下不存在指定类 |
| @ConditionalOnBean | 容器中存在指定Bean |
| @ConditionalOnMissingBean | 容器中不存在指定Bean |
| @ConditionalOnProperty | 配置属性满足条件 |
| @ConditionalOnWebApplication | 是Web应用时 |

### 自定义Starter
1. 创建自动配置模块（xxx-spring-boot-autoconfigure）
2. 编写配置类（@Configuration + @Conditional）
3. 编写properties映射类（@ConfigurationProperties）
4. 在 `META-INF/spring.factories` 中注册配置类
5. 创建Starter模块（xxx-spring-boot-starter），依赖autoconfigure模块

---

## 四、Spring事务管理

### 事务管理方式
- **编程式事务**：使用TransactionTemplate或PlatformTransactionManager手动管理
- **声明式事务**：使用@Transactional注解（底层基于AOP代理）

### @Transactional属性
| 属性 | 说明 |
|------|------|
| propagation | 传播行为（默认REQUIRED） |
| isolation | 隔离级别（默认数据库默认级别） |
| timeout | 超时时间 |
| readOnly | 是否只读 |
| rollbackFor | 指定回滚的异常类型 |
| noRollbackFor | 指定不回滚的异常类型 |

### 事务传播行为（7种）
| 传播行为 | 说明 |
|----------|------|
| REQUIRED | 当前有事务则加入，没有则新建（默认） |
| REQUIRES_NEW | 始终新建事务，暂停当前事务 |
| SUPPORTS | 当前有事务则加入，没有则以非事务执行 |
| NOT_SUPPORTED | 以非事务执行，暂停当前事务 |
| MANDATORY | 必须在事务中调用，否则抛异常 |
| NEVER | 必须在非事务中调用，否则抛异常 |
| NESTED | 当前有事务则创建嵌套事务（保存点），没有则新建 |

### 事务失效的常见场景
1. **方法非public**：Spring AOP只能代理public方法
2. **自调用问题**：同一类中方法调用，不经过代理（解决：注入自身、AopContext.currentProxy()）
3. **异常被catch**：事务管理器感知不到异常，不会回滚
4. **抛出非RuntimeException**：默认只回滚RuntimeException和Error（解决：rollbackFor=Exception.class）
5. **数据库引擎不支持事务**：如MyISAM
6. **传播行为设置不当**：如SUPPORTS在无事务环境下调用

---

## 五、SpringMVC处理流程

### 完整请求处理流程
1. 客户端发送HTTP请求
2. **DispatcherServlet** 接收请求（前端控制器）
3. DispatcherServlet 调用 **HandlerMapping** 查找Handler
4. HandlerMapping 返回 HandlerExecutionChain（Handler + 拦截器链）
5. DispatcherServlet 调用 **HandlerAdapter** 适配执行Handler
6. 执行 **拦截器的preHandle** 方法
7. HandlerAdapter 执行 **Controller方法**（参数解析、数据绑定）
8. Controller 返回 ModelAndView
9. 执行 **拦截器的postHandle** 方法
10. DispatcherServlet 调用 **ViewResolver** 解析视图
11. 渲染视图，返回响应
12. 执行 **拦截器的afterCompletion** 方法

### REST风格下的简化流程
使用@RestController（@Controller + @ResponseBody）时：
- 不经过ViewResolver
- HandlerAdapter通过HttpMessageConverter将返回值序列化为JSON
- 常用Jackson作为JSON序列化库

### 拦截器 vs 过滤器
| 特性 | Filter | HandlerInterceptor |
|------|--------|-------------------|
| 规范 | Servlet规范 | Spring规范 |
| 作用范围 | 所有请求 | 仅Spring管理的请求 |
| 注入Bean | 不方便 | 可以 |
| 执行时机 | 在DispatcherServlet之前 | 在Handler执行前后 |
| 使用场景 | 编码转换、跨域 | 权限校验、日志 |

---

## 六、常用注解详解

### 组件注册
| 注解 | 说明 |
|------|------|
| @Component | 通用组件标记 |
| @Service | 业务层组件 |
| @Repository | 数据访问层组件（自动转换数据库异常） |
| @Controller | 控制层组件 |
| @Configuration | 配置类（Full模式，方法间调用返回同一实例） |
| @Bean | 在配置类中注册Bean |

### 依赖注入
| 注解 | 说明 |
|------|------|
| @Autowired | 按类型注入（Spring） |
| @Qualifier | 配合@Autowired按名称注入 |
| @Resource | 按名称注入（JSR-250） |
| @Value | 注入配置值（@Value("${key}")） |

### Web相关
| 注解 | 说明 |
|------|------|
| @RequestMapping | 映射请求路径 |
| @GetMapping / @PostMapping | 特定HTTP方法映射 |
| @RequestBody | 接收JSON请求体 |
| @ResponseBody | 返回值序列化为JSON |
| @PathVariable | 获取路径变量 |
| @RequestParam | 获取请求参数 |
| @RequestHeader | 获取请求头 |

### 其他常用
| 注解 | 说明 |
|------|------|
| @Transactional | 声明式事务 |
| @Async | 异步方法执行 |
| @Scheduled | 定时任务 |
| @Cacheable | 缓存方法返回值 |
| @Validated | 参数校验 |
| @ExceptionHandler | 全局异常处理 |

---

## 七、Spring Cloud核心组件

### 微服务核心组件（主流方案）
| 功能 | Netflix方案(旧) | Alibaba方案(主流) |
|------|----------------|------------------|
| 服务注册发现 | Eureka | Nacos |
| 配置中心 | Spring Cloud Config | Nacos Config |
| 负载均衡 | Ribbon | Spring Cloud LoadBalancer |
| 服务调用 | Feign | OpenFeign |
| 熔断降级 | Hystrix | Sentinel |
| 网关 | Zuul | Spring Cloud Gateway |
| 分布式事务 | — | Seata |

### Nacos
- 集服务注册与配置管理于一体
- 支持AP和CP模式切换
- 配置的动态刷新（@RefreshScope）

### OpenFeign
- 声明式HTTP客户端
- 接口+注解定义远程调用
- 集成负载均衡和熔断

### Sentinel
- 流量控制（QPS限流、线程数限流）
- 熔断降级（慢调用比例、异常比例、异常数）
- 热点参数限流
- 提供Dashboard监控

### Spring Cloud Gateway
- 基于WebFlux（异步非阻塞）
- 核心概念：路由(Route)、断言(Predicate)、过滤器(Filter)
- 功能：路由转发、负载均衡、权限认证、限流

---

> **使用建议**：Spring/SpringBoot在Java后端面试中占比极高，建议不仅理解原理，更要结合源码关键类（如AbstractAutowireCapableBeanFactory、AnnotationConfigApplicationContext等）加深理解。
