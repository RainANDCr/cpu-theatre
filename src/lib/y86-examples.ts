export interface Y86Example {
  id: string
  title: string
  subtitle: string
  /** 这段程序最值得观察的地方 */
  focus: string
  code: string
}

/**
 * 内置示例程序。Phase 2 的汇编器测试会直接复用这里的源码，
 * 因此示例必须始终是**合法**的 Y86-64 子集，不能为了演示写伪代码。
 */
export const EXAMPLES: Y86Example[] = [
  {
    id: 'add',
    title: '简单加法',
    subtitle: 'Register arithmetic',
    focus: '观察 ALU 如何接收两个寄存器值、条件码如何随结果更新、写回目标是谁。',
    code: `irmovq $10, %rax
irmovq $20, %rbx
addq %rax, %rbx
halt
`,
  },
  {
    id: 'memory',
    title: '内存读写',
    subtitle: 'Store then load',
    focus: '观察写内存时 8 个字节如何以小端序铺在连续地址上，再由 mrmovq 原样读回。',
    code: `irmovq $100, %rax
irmovq $123, %rbx
rmmovq %rbx, 0(%rax)
mrmovq 0(%rax), %rcx
halt
`,
  },
  {
    id: 'branch',
    title: '条件跳转',
    subtitle: 'Conditional branch',
    focus: '观察 subq 把 ZF 置 1 之后，je 如何改变下一条指令地址，而不是顺序执行。',
    code: `irmovq $10, %rax
irmovq $10, %rbx
subq %rax, %rbx
je target
irmovq $1, %rcx
halt

target:
irmovq $2, %rcx
halt
`,
  },
  {
    id: 'stack',
    title: '栈与函数调用',
    subtitle: 'Stack & call',
    focus: '观察 call 压入返回地址、ret 弹出返回地址，以及 %rsp 在两次压栈中的变化。',
    code: `irmovq $0x100, %rsp
irmovq $7, %rax
pushq %rax
call double
popq %rbx
halt

double:
addq %rax, %rax
ret
`,
  },
  {
    id: 'data',
    title: '数据段',
    subtitle: '.pos & .quad',
    focus:
      '观察 .quad 把常数按小端写进镜像、标签 data 如何变成一个地址，以及 mrmovq 从数据段把它读回。',
    code: `irmovq data, %rax
mrmovq 0(%rax), %rbx
halt

.pos 0x40
data: .quad 123
`,
  },
  {
    id: 'asum',
    title: '数组求和',
    subtitle: 'CSAPP Figure 4.7',
    focus:
      '教材原程序：.align 8 之后的 array 落在 0x18，代码从 0x38 继续，栈在 0x200。逐条对照教材左栏地址看。',
    code: `# Execution begins at address 0
    .pos 0
init:   irmovq stack, %rsp
        call main
        halt

# Array of 4 elements
        .align 8
array:  .quad 0x000d000d000d000d
        .quad 0x00c000c000c000c0
        .quad 0x0b000b000b000b00
        .quad 0xa000a000a000a000

main:   irmovq array, %rdi
        irmovq $4, %rsi
        call sum
        ret

# long sum(long *start, long count)
sum:    irmovq $8, %r8
        irmovq $1, %r9
        xorq %rax, %rax
        andq %rsi, %rsi
        jmp test
loop:   mrmovq (%rdi), %r10
        addq %r10, %rax
        addq %r8, %rdi
        subq %r9, %rsi
test:   jne loop
        ret

# Stack starts here and grows to lower addresses
    .pos 0x200
stack:
`,
  },
  {
    id: 'string',
    title: '字符串',
    subtitle: '.string & byte',
    focus:
      'Y86-64 没有字节读写指令：字符串按 UTF-8 落盘，用 mrmovq 读 8 字节再 andq $0xFF 取出第一个字符 0x48（H）。',
    code: `irmovq msg, %rax
mrmovq 0(%rax), %rbx     # 一次读 8 个字节
irmovq $255, %rcx
andq %rcx, %rbx          # 只留最低字节：0x48 = 'H'
halt

.pos 0x40
msg: .string "Hello, Y86!"
`,
  },
]

export const DEFAULT_EXAMPLE = EXAMPLES[0]!

export function findExample(id: string): Y86Example | undefined {
  return EXAMPLES.find((example) => example.id === id)
}
