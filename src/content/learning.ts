/**
 * 学习中心的课程内容。
 *
 * 全部为本项目自行撰写的解释，不复述教材原文。
 * 每个知识点固定五件套：解释 → 演示 → 示例 → 实验入口 → 自测。
 */

export interface SectionDemo {
  kind: 'registers' | 'encoding' | 'stages' | 'hcl' | 'pipe'
  /** HCL / 编码演示的正文 */
  text?: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation: string
}

export interface LearningSection {
  id: string
  title: string
  paragraphs: string[]
  demo?: SectionDemo
  /** 相关实验的跳转 */
  lab?: { to: string; label: string }
}

export interface LearningModule {
  id: string
  code: string
  title: string
  english: string
  summary: string
  tone: 'blue' | 'purple' | 'cyan' | 'amber'
  sections: LearningSection[]
  quiz: QuizQuestion[]
}

export const LEARNING_MODULES: LearningModule[] = [
  {
    id: 'isa',
    code: 'MODULE 01',
    title: 'Y86-64 指令集',
    english: 'Instruction Set Architecture',
    summary: '处理器对外承诺的全部：有哪些寄存器、有哪些指令、每条指令编码成什么字节。',
    tone: 'blue',
    sections: [
      {
        id: 'isa-contract',
        title: 'ISA 是一份契约',
        paragraphs: [
          '指令集体系结构描述的是「处理器看起来是什么样」，而不是「内部怎么实现」。同一份 ISA 可以有顺序实现、流水线实现，甚至用微码解释——只要对外可见的状态变化一致。',
          'Y86-64 是 x86-64 的教学子集：同样是 64 位、15 个通用寄存器、小端序，但去掉了几百条指令和复杂的寻址方式，只留下 27 条。少掉的部分不影响理解处理器的骨架。',
          '这也解释了本项目的验收方式：同一段程序分别在 SEQ 与 PIPE 上运行，寄存器、内存、条件码必须逐字段相等——因为它们实现的是同一份契约。',
        ],
        lab: { to: '/editor', label: '在编辑器里看指令编码' },
      },
      {
        id: 'isa-state',
        title: '程序员可见状态',
        paragraphs: [
          '只有五样东西是「可见」的：15 个 64 位通用寄存器、程序计数器 PC、条件码 ZF/SF/OF、状态码 Stat，以及内存。其余（流水线寄存器、转发选择器、总线）都是实现细节。',
          '注意 %rsp 没有特殊地位：它就是 15 个寄存器里的第 5 个（编号 4），只是 pushq/popq/call/ret 约定俗成地用它做栈指针。这是一种约定，不是硬件特权。',
          '状态码有四种：AOK 正常、HLT 执行了 halt、ADR 访存越界、INS 遇到非法编码。后两种是异常终止——处理器必须停下，而不是跳过。',
        ],
        demo: { kind: 'registers' },
        lab: { to: '/registers', label: '打开 Register Lab' },
      },
      {
        id: 'isa-encoding',
        title: '编码：一条指令的字节长什么样',
        paragraphs: [
          '每条指令的第一个字节被劈成两半：高 4 位是 icode（指令类型），低 4 位是 ifun（功能）。所以 `0x60` 是 addq，`0x61` 就是 subq——它们只差在 ifun。',
          '需要寄存器的指令，第二个字节再劈一次：高 4 位 rA、低 4 位 rB。0xF 是 RNONE，表示「这个位置没有寄存器」。',
          '带常数的指令在最后跟 8 个字节，小端序。所以 `irmovq` 是 10 字节、`jmp` 是 9 字节（目标地址没有 rA:rB 字节，紧跟在第 1 字节之后）。',
        ],
        demo: {
          kind: 'encoding',
          text: `irmovq $10, %rax
30 F0 0A 00 00 00 00 00 00 00
│  │  └─────────┬──────────┘
│  │            └─ 立即数 10（小端）
│  └─ rA=F(RNONE), rB=0(%rax)
└─ icode=3(irmovq), ifun=0`,
        },
      },
      {
        id: 'isa-cc',
        title: '条件码：算术留下的痕迹',
        paragraphs: [
          'addq/subq/andq/xorq 会顺手更新三个标志：ZF 表示结果为 0，SF 是结果的符号位，OF 表示有符号溢出。',
          'OF 的判定值得单独记：只有当两个同号数相加得到异号、或两个异号数相减得到与目的操作数相反的符号时，才算溢出。所以 `0x8000000000000000 - 1` 会溢出成正数——SF=0 但真值是负的，这正是 OF 要表达的矛盾。',
          'cmov 与 jXX 都只是读这三个标志，自己从不修改它们。这也意味着：两条指令之间如果插入了别的算术指令，条件码就被覆盖了。',
        ],
      },
    ],
    quiz: [
      {
        question: '字节 0x30 解码后是什么？',
        options: ['addq', 'irmovq', 'rrmovq', 'halt'],
        answer: 1,
        explanation: 'icode=3 是 irmovq，ifun=0。0x60 才是 addq。',
      },
      {
        question: '为什么 irmovq 的 rA 字段固定为 0xF？',
        options: [
          '因为立即数存放在 rA 里',
          '因为这条指令没有源寄存器，RNONE 表示「不读寄存器」',
          '因为 0xF 代表 %r14',
          '因为要留作扩展',
        ],
        answer: 1,
        explanation:
          'irmovq 的源是立即数 valC，不读任何寄存器；rA=RNONE 让寄存器文件的读端口返回 0，这个值随后被丢弃。',
      },
    ],
  },
  {
    id: 'logic',
    code: 'MODULE 02',
    title: '逻辑设计',
    english: 'Logic Design & HCL',
    summary: '用门和选择器拼出数据通路；用 HCL 描述「哪种情况走哪条线」。',
    tone: 'purple',
    sections: [
      {
        id: 'logic-gates',
        title: '门与组合电路',
        paragraphs: [
          '与、或、非、异或四种门就能拼出所有组合逻辑。组合的意思是：输出只取决于当前输入，没有记忆。',
          '一个 64 位加法器本质上就是 64 个全加器串起来，每一位把进位传给下一位。ALU 在这个基础上加了选择器，用 ALUfun 决定做哪一种运算。',
          '组合电路没有时钟也能工作——信号沿着线传播，稳定后输出就是结果。真正需要时钟的是「记住」这件事。',
        ],
        lab: { to: '/logic', label: '在 Logic Lab 里拨开关' },
      },
      {
        id: 'logic-hcl',
        title: 'HCL：不是程序的「如果」',
        paragraphs: [
          'HCL 描述的是电路连接，不是执行流程。`[ 条件 : 值; 1 : 默认值 ]` 读作「当条件成立时，这条线接这个值」，所有分支是同时存在的。',
          '所以 HCL 里没有「先判断 A 再判断 B」的顺序，只有优先级：写在前面的条件优先。这也是为什么 `1 : ...` 总是放在最后当兜底。',
          '本项目的译码器就是把 HCL 的规则翻译成了 TypeScript 的 if/else——顺序与优先级一一对应，读代码时可以直接对照。',
        ],
        demo: {
          kind: 'hcl',
          text: `# 写回端口：三条规则同时存在，按优先级选一个
word dstE = [
    icode in { RRMOVQ } && Cnd : rB;      # 条件传送成立才写
    icode in { IRMOVQ, OPQ }  : rB;      # 算术与立即数总写
    icode in { PUSHQ, POPQ, CALL, RET } : RSP;
    1 : RNONE;                            # 其余：不写任何寄存器
]`,
        },
      },
      {
        id: 'logic-clock',
        title: '时钟与状态',
        paragraphs: [
          '时钟的作用是规定「什么时候允许状态改变」。寄存器在时钟上升沿采样输入，其余时间保持。',
          '有了这个约定，组合逻辑可以慢慢算，只要在下一个边沿之前稳定下来就行。SEQ 一拍走完六个阶段，PIPE 每拍只走一段——差别只在「一拍里塞多少组合逻辑」。',
          '条件码、寄存器文件、PC 都是时序元件；ALU、译码逻辑、内存的地址译码是组合逻辑。看懂这个划分，就懂了一半的数据通路。',
        ],
      },
    ],
    quiz: [
      {
        question: 'MUX 的选择端 S=1 时输出哪一个输入？',
        options: ['A', 'B', 'A 与 B 的异或', '0'],
        answer: 1,
        explanation: 'MUX 就是二选一：S=0 选 A，S=1 选 B。CPU 里所有的「走哪条线」都是 MUX。',
      },
    ],
  },
  {
    id: 'seq',
    code: 'MODULE 03',
    title: 'SEQ：顺序实现',
    english: 'Sequential Implementation',
    summary: '一条指令用一拍走完六个阶段。慢，但每个信号都能看清。',
    tone: 'cyan',
    sections: [
      {
        id: 'seq-overview',
        title: '六阶段一图流',
        paragraphs: [
          '取指 → 译码 → 执行 → 访存 → 写回 → 更新 PC。六个阶段串成一条链，同一时刻只有一个阶段在工作。',
          '这样做的好处是简单：每个阶段只需要关心上一阶段的输出，不需要考虑「后面还有四条指令在飞」。代价是慢——每条指令都要占满一整拍。',
        ],
        demo: { kind: 'stages' },
        lab: { to: '/simulator', label: '在模拟器里单步' },
      },
      {
        id: 'seq-decode',
        title: '译码：谁被读，谁被写',
        paragraphs: [
          '译码阶段要回答两个问题：读哪两个寄存器、写哪个寄存器。答案不在指令的某个字段里，而是由指令类型推出来的。',
          'popq 与 ret 的指令里没有 %rsp，但它们必须读 %rsp 才能知道栈顶在哪；call 与 pushq 没有写 %rsp 的字段，却必须更新它。这些「隐式寄存器」是译码逻辑里最容易写错的地方。',
          'mrmovq 的目的寄存器放在 rA 字段，写回走 dstM 端口；其余算术指令走 dstE 端口。两个写端口的存在，让 popq 能在同一拍里既更新 %rsp 又写入弹出的值。',
        ],
      },
      {
        id: 'seq-execute',
        title: '执行：ALU 的两个输入从哪来',
        paragraphs: [
          'ALU 不是只会做加减法，它还负责算地址。所以它的两个输入按指令类型选择：算术运算取 valA，带常数的取 valC，压栈取 -8，出栈取 +8。',
          'rrmovq 的技巧是给 aluB 接 0：传送变成 `0 + valA`，不需要为它单独开一条通路。',
          '减法方向必须记牢：`subq %rax, %rbx` 是 `%rbx − %rax`，目的操作数在左。写反了，所有比较都会得出相反的结论。',
        ],
      },
      {
        id: 'seq-pc',
        title: '更新 PC：下一条去哪',
        paragraphs: [
          '四条规则：halt 原地不动；ret 用内存里读出的返回地址；跳转条件成立时用 valC；其余用 valP。',
          '注意 ret 用的是 valM 而不是 valC——ret 根本没有常数段。这一点写错，函数调用会跳回自己的下一条指令，表现为死循环。',
        ],
      },
    ],
    quiz: [
      {
        question: 'popq %rcx 的访存地址来自哪里？',
        options: ['valE（ALU 算出的 %rsp+8）', 'valA（译码读到的旧 %rsp）', 'valC', 'valP'],
        answer: 1,
        explanation:
          '出栈要读的是「当前栈顶」，也就是自增之前的 %rsp。valE 是 %rsp+8，那是出栈之后的新栈顶，不能用来取数。',
      },
      {
        question: 'subq %rax, %rbx 执行后 %rbx 等于？',
        options: ['%rax − %rbx', '%rbx − %rax', '%rbx + %rax', '%rax + %rbx'],
        answer: 1,
        explanation: 'Y86-64 的二进制运算统一是「目的 OP 源」，目的操作数在右写、在左算。',
      },
    ],
  },
  {
    id: 'pipe',
    code: 'MODULE 04',
    title: 'PIPE：流水线实现',
    english: 'Pipelined Implementation',
    summary: '五条指令同时在飞。吞吐上去了，冒险也跟着来了。',
    tone: 'amber',
    sections: [
      {
        id: 'pipe-why',
        title: '为什么要流水线',
        paragraphs: [
          '把六个阶段拆开、每个阶段配一套独立硬件，就能让六条指令同时处在不同阶段。单条指令的延迟没变，但每个时钟周期都能完成一条——吞吐量提高数倍。',
          '衡量的指标是 CPI（每指令周期数）。SEQ 的 CPI 恒为 1（一拍一条），理想流水线的 CPI 也接近 1，但因为冒险会产生额外周期，实际会略高于 1。',
          'Pipeline Lab 顶部的 CPI 是用「周期数 ÷ 退休指令数」实时算出来的，不是写死的常数。',
        ],
        lab: { to: '/pipeline', label: '打开 Pipeline Lab' },
      },
      {
        id: 'pipe-registers',
        title: '流水线寄存器',
        paragraphs: [
          '阶段之间要有寄存器把结果「存住」：D 寄存器存取到的指令，E 寄存器存译码出的操作数，M 存 ALU 结果，W 存待写回的值。',
          '这些寄存器不在程序员可见状态里——它们只是让五条指令互不干扰的缓冲。程序跑完后，它们的内容没有任何意义。',
          '每一拍结束时，所有寄存器同时更新。这就是为什么流水线图要竖着看：同一列是同一拍，同一行是同一段。',
        ],
        demo: { kind: 'pipe' },
      },
      {
        id: 'pipe-data-hazard',
        title: '数据冒险与转发',
        paragraphs: [
          '后一条指令要用前一条刚算出的结果时，寄存器文件里还是旧值。最直接的办法是等两拍，但太浪费。',
          '转发（forwarding）把 ALU 的输出直接从流水线寄存器接回 ALU 的输入端，跳过寄存器文件。只要生产者已经算完、还在 M 或 W 段，值就能拿到。',
          '有一种情况转发救不了：加载/使用冒险。`mrmovq` 的数据要到 M 段结束才从内存出来，而紧随其后的指令在 E 段就要用——只能暂停一拍，插一个气泡。',
        ],
        lab: { to: '/pipeline', label: '在流水线里看转发与暂停' },
      },
      {
        id: 'pipe-control-hazard',
        title: '控制冒险：猜错了怎么办',
        paragraphs: [
          '取指时还不知道跳转条件是否成立，只能猜。本项目采用教材的策略：预测跳转发生，直接把 PC 设成目标地址。',
          '猜对没有代价；猜错时，已经取进来的指令要作废（变成气泡），PC 回到 fall-through 地址。这个「作废」就是流水线图里突然出现的气泡。',
          'ret 更麻烦：返回地址要到 W 段才从内存读出来。所以在 ret 经过 D/E/M 的这几拍里，取指阶段直接停住，什么都不取——宁可空转，也不执行错误的指令。',
        ],
      },
    ],
    quiz: [
      {
        question: '加载/使用冒险为什么不能靠转发解决？',
        options: [
          '因为转发线路太长',
          '因为数据要到访存阶段结束才从内存出来，执行阶段拿不到',
          '因为寄存器编号冲突',
          '因为加载指令不能被转发',
        ],
        answer: 1,
        explanation:
          '转发只能在值已经算出来之后进行。mrmovq 的值在 M 段末尾才可用，而依赖它的指令在下一拍就进入 E 段——时间上差一拍，只能暂停。',
      },
      {
        question: '分支预测失败时，流水线做了什么？',
        options: [
          '重启整个处理器',
          '把已取入的指令变成气泡，并把 PC 改回 fall-through 地址',
          '忽略错误，继续执行',
          '暂停到跳转指令退休',
        ],
        answer: 1,
        explanation: '预测失败不需要重启，只要丢弃错误路径上的指令（气泡）并纠正 PC 即可。',
      },
    ],
  },
]

export function findModule(id: string): LearningModule | undefined {
  return LEARNING_MODULES.find((module) => module.id === id)
}

export const TOTAL_SECTIONS = LEARNING_MODULES.reduce(
  (sum, module) => sum + module.sections.length,
  0,
)
