import time

# ANSI Colors for Clear Terminal Visualization
BLUE = "\033[94m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

def to_bin(val, bits=8):
    """Formats an integer into spaced binary (e.g., 5 -> 0000 0101)."""
    mask = (1 << bits) - 1
    b = format(val & mask, f'0{bits}b')
    return " ".join(b[i:i+4] for i in range(0, len(b), 4))


class RAM:
    """Simulates 256 Bytes of Physical Main Memory."""
    def __init__(self, size=256):
        self.memory = [0x00] * size

    def write(self, address, value):
        self.memory[address & 0xFF] = value & 0xFF

    def read(self, address):
        return self.memory[address & 0xFF]

    def dump(self, start=0x00, end=0x1F):
        print(f"\n{MAGENTA}{BOLD}=== PHYSICAL RAM DUMP (0x{start:02X} - 0x{end:02X}) ==={RESET}")
        for addr in range(start, end + 1, 8):
            row = "  ".join(f"{self.memory[a]:02X}" for a in range(addr, addr + 8))
            print(f"  0x{addr:02X} : {row}")
        print()


class HardwareALU:
    """Performs arithmetic using ONLY bitwise logic gates (XOR, AND, OR, SHIFTS)."""
    
    @staticmethod
    def ripple_carry_add(a, b, trace=True):
        """Simulates an 8-bit Hardware Ripple-Carry Adder using XOR and AND gates."""
        a &= 0xFF
        b &= 0xFF
        carry_in = 0
        result = 0
        carry_chain = []

        for bit in range(8):
            bit_a = (a >> bit) & 1
            bit_b = (b >> bit) & 1
            
            # Full Adder Logic Equations:
            # Sum = A XOR B XOR Cin
            # Cout = (A AND B) OR (Cin AND (A XOR B))
            sum_bit = bit_a ^ bit_b ^ carry_in
            carry_out = (bit_a & bit_b) | (carry_in & (bit_a ^ bit_b))
            
            result |= (sum_bit << bit)
            carry_chain.append(str(carry_out))
            carry_in = carry_out

        if trace:
            print(f"  {CYAN}[ALU Gate Trace]{RESET} Carry Bits (MSB<-LSB): {''.join(reversed(carry_chain))}")
        return result, carry_in

    @classmethod
    def twos_complement_sub(cls, a, b):
        """Subtracts using Two's Complement: A + (~B + 1)."""
        inverted_b = (~b) & 0xFF
        neg_b, _ = cls.ripple_carry_add(inverted_b, 1, trace=False)
        print(f"  {CYAN}[ALU Two's Comp]{RESET} Inverted BX (~{b}) + 1 = {to_bin(neg_b)} (-{b})")
        return cls.ripple_carry_add(a, neg_b, trace=True)

    @classmethod
    def shift_and_add_mul(cls, a, b):
        """Hardware Shift-and-Add Multiplication Algorithm."""
        multiplicand = a & 0xFF
        multiplier = b & 0xFF
        product = 0
        print(f"  {CYAN}[ALU Hardware Multiplier]{RESET} Running 8-Cycle Shift-and-Add:")
        for cycle in range(8):
            if multiplier & 1:
                product, _ = cls.ripple_carry_add(product, multiplicand, trace=False)
                action = "LSB=1 -> ADD & SHIFT"
            else:
                action = "LSB=0 -> SHIFT ONLY "
            print(f"    Cycle {cycle+1}: {action} | Partial Product = {to_bin(product)}")
            multiplicand = (multiplicand << 1) & 0xFF
            multiplier >>= 1
        return product

    @classmethod
    def restoring_division(cls, dividend, divisor):
        """Hardware Restoring Division Algorithm."""
        if divisor == 0:
            raise ZeroDivisionError("INTERRUPT 0x00: Divide-by-Zero Hardware Fault!")
        
        quotient = 0
        remainder = 0
        print(f"  {CYAN}[ALU Restoring Divider]{RESET} Running 8-Cycle Bit-Shift Division:")
        for i in range(7, -1, -1):
            remainder = (remainder << 1) | ((dividend >> i) & 1)
            if remainder >= divisor:
                remainder, _ = cls.twos_complement_sub_silent(remainder, divisor)
                quotient |= (1 << i)
        return quotient, remainder

    @classmethod
    def twos_complement_sub_silent(cls, a, b):
        neg_b, _ = cls.ripple_carry_add((~b) & 0xFF, 1, trace=False)
        return cls.ripple_carry_add(a, neg_b, trace=False)


class CPU:
    """Simulates CPU Registers, Control Unit, Bus Interface, and Flags."""
    def __init__(self, ram):
        self.ram = ram
        self.reg = {
            "PC": 0x10,    # Program Counter (Code Segment starts at 0x10)
            "IR": 0x00,    # Instruction Register
            "MAR": 0x00,   # Memory Address Register
            "MDR": 0x00,   # Memory Data Register
            "AX": 0x00,    # Accumulator
            "BX": 0x00,    # Base Register
            "SP": 0xFF     # Stack Pointer (grows downwards from 0xFF)
        }
        self.flags = {"ZF": 0, "SF": 0, "CF": 0, "OF": 0}

    def fetch_from_ram(self, address):
        """Simulates Memory Bus Read Cycle: PC -> MAR -> RAM -> MDR."""
        self.reg["MAR"] = address
        self.reg["MDR"] = self.ram.read(address)
        return self.reg["MDR"]

    def update_flags(self, result_8bit, carry, signed_expected):
        self.flags["ZF"] = 1 if result_8bit == 0 else 0
        self.flags["SF"] = 1 if (result_8bit & 0x80) else 0  # Check 8th bit (MSB)
        self.flags["CF"] = carry
        self.flags["OF"] = 1 if (signed_expected > 127 or signed_expected < -128) else 0

    def print_registers(self):
        print(f"  ┌──────────────────────────────────────────────────────────┐")
        print(f"  │ PC: 0x{self.reg['PC']:02X} | IR: 0x{self.reg['IR']:02X} | MAR: 0x{self.reg['MAR']:02X} | MDR: 0x{self.reg['MDR']:02X} | SP: 0x{self.reg['SP']:02X} │")
        print(f"  │ AX: {self.reg['AX']:3d} [{to_bin(self.reg['AX'])}]   |   BX: {self.reg['BX']:3d} [{to_bin(self.reg['BX'])}]   │")
        print(f"  │ FLAGS -> ZF:{self.flags['ZF']}  SF:{self.flags['SF']}  CF:{self.flags['CF']}  OF:{self.flags['OF']}                        │")
        print(f"  └──────────────────────────────────────────────────────────┘")


class AdvancedMiniKernel:
    """Simulates OS Kernel, Process Control Block (PCB), and System Call Table."""
    OPCODES = {"+": 0x01, "-": 0x02, "*": 0x03, "/": 0x04}
    MNEMONICS = {0x01: "ADD", 0x02: "SUB", 0x03: "MUL", 0x04: "DIV"}

    def __init__(self):
        self.ram = RAM(256)
        self.cpu = CPU(self.ram)
        self.pid_counter = 1001
        self.privilege_ring = 3  # Ring 3 = User Mode, Ring 0 = Kernel Mode

    def pause(self):
        input(f"{CYAN}   [Press ENTER to advance clock cycle...]{RESET}")

    def execute_process(self, num1, op_char, num2):
        # 1. CREATE PROCESS CONTROL BLOCK (PCB) IN USER MODE
        pid = self.pid_counter
        self.pid_counter += 1
        pcb = {"PID": pid, "STATE": "READY", "MODE": "USER (Ring 3)"}

        print(f"\n{BLUE}{BOLD}=== STAGE 1: PROCESS CREATION & SYSTEM CALL (TRAP INT 0x80) ==={RESET}")
        print(f"• Created Process PCB -> PID: {pcb['PID']} | State: {pcb['STATE']} | Privilege: {pcb['MODE']}")
        print(f"• Pushing operands onto User Stack (SP = 0x{self.cpu.reg['SP']:02X})...")
        
        # Store instruction & operands in RAM (Data Segment 0x00-0x02, Code Segment at PC)
        code_addr = self.cpu.reg["PC"]
        self.ram.write(code_addr, self.OPCODES[op_char])
        self.ram.write(0x00, num1)
        self.ram.write(0x01, num2)

        # Trigger System Call
        self.privilege_ring = 0
        pcb["STATE"] = "RUNNING"
        pcb["MODE"] = "KERNEL (Ring 0)"
        print(f"• {YELLOW}SYSCALL #42 (sys_alu_compute){RESET} -> Switched to {RED}{BOLD}{pcb['MODE']}{RESET}")
        self.pause()

        # 2. FETCH & DECODE VIA MEMORY BUS (MAR / MDR)
        print(f"\n{RED}{BOLD}=== STAGE 2: INSTRUCTION FETCH & DECODE (Memory Bus Cycle) ==={RESET}")
        opcode_byte = self.cpu.fetch_from_ram(code_addr)
        self.cpu.reg["IR"] = opcode_byte
        self.cpu.reg["PC"] += 1
        mnemonic = self.MNEMONICS[opcode_byte]
        print(f"• MAR loaded with 0x{code_addr:02X} -> Fetched Opcode 0x{opcode_byte:02X} ({mnemonic}) into IR.")
        self.cpu.print_registers()
        self.pause()

        # 3. LOAD OPERANDS FROM RAM INTO CPU REGISTERS
        print(f"\n{RED}{BOLD}=== STAGE 3: MEMORY-TO-REGISTER TRANSFER ==={RESET}")
        self.cpu.reg["AX"] = self.cpu.fetch_from_ram(0x00)
        self.cpu.reg["BX"] = self.cpu.fetch_from_ram(0x01)
        print(f"• Loaded Operand 1 from RAM[0x00] into AX, Operand 2 from RAM[0x01] into BX:")
        self.cpu.print_registers()
        self.pause()

        # 4. HARDWARE GATE-LEVEL ALU EXECUTION
        print(f"\n{RED}{BOLD}=== STAGE 4: LOGIC-GATE ALU EXECUTION ({mnemonic}) ==={RESET}")
        try:
            carry = 0
            if op_char == "+":
                res, carry = HardwareALU.ripple_carry_add(num1, num2)
                expected = num1 + num2
            elif op_char == "-":
                res, carry = HardwareALU.twos_complement_sub(num1, num2)
                expected = num1 - num2
            elif op_char == "*":
                res = HardwareALU.shift_and_add_mul(num1, num2)
                expected = num1 * num2
            elif op_char == "/":
                res, rem = HardwareALU.restoring_division(num1, num2)
                self.cpu.reg["BX"] = rem
                expected = num1 // num2
                print(f"  {CYAN}[ALU Result]{RESET} Quotient stored in AX ({res}), Remainder stored in BX ({rem})")

            self.cpu.reg["AX"] = res
            self.ram.write(0x02, res)  # Write result back to RAM[0x02]
            self.cpu.update_flags(res, carry, expected)
            self.cpu.print_registers()
            self.pause()

            # 5. INTERRUPT RETURN (IRET) & TERMINATE PROCESS
            self.privilege_ring = 3
            pcb["STATE"] = "TERMINATED"
            print(f"\n{GREEN}{BOLD}=== STAGE 5: KERNEL RETURN (IRET) & OUTPUT ==={RESET}")
            print(f"• Result written to RAM[0x02]. Process {pid} State -> {pcb['STATE']}.")
            print(f"• Privilege restored to {BLUE}USER MODE (Ring 3){RESET}.")
            print(f"• {BOLD}8-Bit Binary Result  :{RESET} {GREEN}{to_bin(res)}{RESET}")
            print(f"• {BOLD}Unsigned Decimal     :{RESET} {GREEN}{res}{RESET}")
            if res & 0x80:
                signed_val = res - 256
                print(f"• {BOLD}Signed (2's Comp)    :{RESET} {YELLOW}{signed_val}{RESET}")
            print()

        except ZeroDivisionError as e:
            self.privilege_ring = 3
            print(f"\n{RED}{BOLD}[KERNEL EXCEPTION HANDLER]: {e}{RESET}")
            print(f"{YELLOW}Process {pid} aborted safely. Control returned to User Mode.{RESET}\n")


def main():
    kernel = AdvancedMiniKernel()
    print(f"{BOLD}==========================================================={RESET}")
    print(f"{BOLD}   MINI-OS KERNEL, RAM & GATE-LEVEL ALU SIMULATOR (8-BIT){RESET}")
    print(f"{BOLD}==========================================================={RESET}")
    print("Commands:")
    print("  • Math expression : <num1> <+|-|*|/> <num2>  (e.g., 14 + 9)")
    print("  • Inspect Memory  : mem")
    print("  • Inspect CPU     : regs")
    print("  • Quit            : exit\n")

    while True:
        cmd = input(f"{BLUE}[Ring3@UserShell]$ {RESET}").strip().lower()
        if cmd == "exit":
            break
        elif cmd == "mem":
            kernel.ram.dump(0x00, 0x1F)
            continue
        elif cmd == "regs":
            kernel.cpu.print_registers()
            continue

        parts = cmd.split()
        if len(parts) != 3 or parts[1] not in ["+", "-", "*", "/"]:
            print(f"{YELLOW}Invalid command. Try '12 + 7', 'mem', 'regs', or 'exit'.{RESET}\n")
            continue

        try:
            n1, op, n2 = int(parts[0]), parts[1], int(parts[2])
            kernel.execute_process(n1, op, n2)
        except ValueError:
            print(f"{YELLOW}Operands must be integers.{RESET}\n")

if __name__ == "__main__":
    main()