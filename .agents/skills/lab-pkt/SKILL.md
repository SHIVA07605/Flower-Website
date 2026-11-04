---
name: lab-pkt
description: >-
  Create, build, inspect, modify, and serialize Cisco Packet Tracer labs (.pkt) and scored activities (.pka) entirely offline without opening Packet Tracer. Supports network topologies with routers (2911, 1941, 2901, 2811), switches (2960, 3560 L3), PCs, Server-PT, Hubs, VLANs (access/trunk/SVI/router-on-a-stick), routing (OSPF, BGP, EIGRP, RIP, static), DHCP pools and relays, ACLs, NAT, Server-PT services (HTTP, DNS, AAA, NTP, TFTP), and scored .pka activities. Use when the user asks to create, modify, inspect, or troubleshoot Cisco Packet Tracer files, labs, or network topologies.
---

# lab-pkt (Cisco Packet Tracer Lab & Activity Builder)

`lab-pkt` is an offline engine and toolkit to generate, read, modify, and inspect Cisco Packet Tracer `.pkt` and `.pka` files without opening Packet Tracer. Devices come already cabled, addressed, and configured.

---

## Capabilities

- **Declarative Lab Specification**: Define devices, links, IP/CIDR addresses, VLANs, and routing in a YAML or JSON spec, and produce a fully cabled and configured `.pkt` file and SVG diagram.
- **Routers & Switches**: Cisco 2911, 1941, 2901, 2811 routers, 2960-24TT L2 switches, 3560-24PS L3 switches, PC-PT, Laptop-PT, and Server-PT hosts.
- **VLANs & Trunking**: Access ports, 802.1Q trunks, SVIs (management IP on switches), and subinterfaces (Router-on-a-stick).
- **Routing Protocols**: Automatic or manual calculation for `ospf`, `bgp`, `eigrp`, `rip`, and `static` routes across the topology graph.
- **Services & Security**: Server-PT services (HTTP, DNS, TFTP, NTP, AAA/RADIUS, Syslog), DHCP pools, DHCP relay (`ip helper-address`), standard/extended ACLs (`ip access-group`), and NAT/PAT (`ip nat inside/outside`, overload).
- **Scored Activities (`.pka`)**: Generate student practice activities with HTML instructions, initial vs. answer networks, wizard passwords, and timers.
- **Offline Inspection & Codec**: Decompile `.pkt`/`.pka` files into XML, extract per-device IOS running configurations, inspect link connections, and diff labs.

---

## Architecture & Layout

This skill directory contains:
- `src/ptlab/`: The high-level lab builder, spec parser, planner, and MCP server primitives.
  - `spec.py`: Pydantic / dataclass schemas for lab specifications.
  - `planner.py`: IP calculation, routing graph calculation, VLAN and interface planning.
  - `builder.py`: Generates the `.pkt` using the underlying codec.
  - `preview.py`: Generates SVG canvas preview with Packet Tracer icons.
  - `mcp_server.py`: MCP tool definitions (`pt_plan`, `pt_build`, `pt_preview`, `pt_add_device`, etc.).
- `vendor/packet-tracer-pkt-format/`: The byte-exact reverse-engineered codec (`src/pkt_core`) and `tools/lab_api.py`.
  - `tools/device_templates.json`: 137 factory device models and 78 module templates.
  - `tools/network_seed.xml`: Clean network XML template.
  - `tools/make_scored_lab.py`: Scored `.pka` generator.

---

## 1. Declarative Lab Spec (YAML / JSON)

To generate a lab in one shot, create a spec file (`lab.yaml` or `lab.json`):

```yaml
name: enterprise_network
routing: ospf        # none | static | rip | ospf | eigrp | bgp
ospf_process: 1
ospf_area: 0
dns: 8.8.8.8

nodes:
  - name: R1
    model: 2911
    x: 200
    y: 200
    interfaces:
      - {port: GigabitEthernet0/0, ip: 10.0.0.1/30}
      - {port: GigabitEthernet0/1.10, ip: 192.168.10.1/24, dot1q: 10}
      - {port: GigabitEthernet0/1.20, ip: 192.168.20.1/24, dot1q: 20}
    dhcp: true         # creates pools for connected subnets

  - name: R2
    model: 2911
    x: 500
    y: 200
    interfaces:
      - {port: GigabitEthernet0/0, ip: 10.0.0.2/30}
      - {port: GigabitEthernet0/1, ip: 192.168.30.1/24}
    dhcp: true

  - name: SW1
    model: 2960-24TT
    x: 200
    y: 400
    vlans:
      - {id: 10, name: SALES}
      - {id: 20, name: ENG}
    trunks: [GigabitEthernet0/1]
    access:
      - {port: FastEthernet0/1, vlan: 10}
      - {port: FastEthernet0/2, vlan: 20}

  - name: PC1
    model: PC-PT
    x: 100
    y: 550
    dhcp: true

  - name: PC2
    model: PC-PT
    x: 300
    y: 550
    dhcp: true

links:
  - {a: R1, a_port: GigabitEthernet0/0, b: R2, b_port: GigabitEthernet0/0}
  - {a: R1, a_port: GigabitEthernet0/1, b: SW1, b_port: GigabitEthernet0/1}
  - {a: SW1, a_port: FastEthernet0/1, b: PC1, b_port: FastEthernet0}
  - {a: SW1, a_port: FastEthernet0/2, b: PC2, b_port: FastEthernet0}
```

### Python Execution:
Run from this skill directory or add `src` and `vendor/packet-tracer-pkt-format/src` to `PYTHONPATH`:

```python
import sys
sys.path.insert(0, "src")
sys.path.insert(0, "vendor/packet-tracer-pkt-format/src")
sys.path.insert(0, "vendor/packet-tracer-pkt-format/tools")

import yaml
from ptlab.spec import LabSpec
from ptlab.planner import plan_lab
from ptlab.builder import build_pkt

with open("lab.yaml") as f:
    spec = LabSpec(**yaml.safe_load(f))

plan = plan_lab(spec)
build_pkt(plan, "output_lab.pkt")
```

---

## 2. Low-Level Python API (`lab_api`)

To programmatically construct a topology device by device:

```python
import sys
sys.path.insert(0, "vendor/packet-tracer-pkt-format/src")
sys.path.insert(0, "vendor/packet-tracer-pkt-format/tools")
import lab_api

models, modules = lab_api.load_templates("vendor/packet-tracer-pkt-format/tools/device_templates.json")
lab = lab_api.Lab("vendor/packet-tracer-pkt-format/tools/network_seed.xml", models, modules)

# Always prune seed devices before adding new ones
lab.prune_seed_devices()

r1 = lab.add_device(
    "2911", "R1", 200, 300,
    install="HWIC-2T",
    ios_config=[
        "hostname R1",
        "interface GigabitEthernet0/0",
        " ip address 192.168.1.1 255.255.255.0",
        " no shutdown",
        "end"
    ]
)

sw1 = lab.add_device("2960-24TT", "SW1", 400, 300)
pc1 = lab.add_device("PC-PT", "PC1", 600, 300, pc_ip=("192.168.1.10", "255.255.255.0", "192.168.1.1"))

lab.link(r1, "GigabitEthernet0/0", sw1, "GigabitEthernet0/1")
lab.link(sw1, "FastEthernet0/1", pc1, "FastEthernet0")

lab.save("my_lab.pkt")
```

---

## 3. Reading and Inspecting Existing Labs (`pkt_core`)

To decompile and analyze existing `.pkt` or `.pka` files:

```python
import sys
sys.path.insert(0, "vendor/packet-tracer-pkt-format/src")
from pkt_core import decode, decode_bytes, encode_bytes
from pkt_core.models import Lab

# Automatically detects Packet Tracer container format (PT 4.1 through 9.0.1)
container = decode("existing_lab.pkt")
lab = Lab.from_bytes(container.xml)

print(f"Format Version: {lab.version}, Is Scored Activity: {lab.is_activity}")

for device in lab.devices:
    print(f"Device: {device.name} ({device.model}) at ({device.position})")
    for port in device.ports:
        print(f"  Port: {port.name}")
```

---

## 4. Generating Scored Activities (`.pka`)

Use `tools/make_scored_lab.py` to create auto-graded student labs:

```bash
python vendor/packet-tracer-pkt-format/tools/make_scored_lab.py \
  --out student_lab.pka \
  --spec topology.json \
  --password secretWizardPass \
  --prune-seed \
  --feedback "Congratulations! All network objectives have been met."
```

---

## Best Practices & Pitfalls

1. **Seed Devices**: `network_seed.xml` comes with 7 default devices (`Server`, `Power Distribution Device0`, `PC-B`, `PC-A`, `SW1`, `R2`, `R1`). Always call `lab.prune_seed_devices()` when building new topologies to avoid name collisions.
2. **Cisco Banner MOTD Delimiter**: Raw control characters like `0x03` (`^C`) are stored literally inside `<LINE>`. Never re-parse with strict XML validators.
3. **No Packet Tracer Needed**: Building and verifying files runs in pure Python with standard libraries.

