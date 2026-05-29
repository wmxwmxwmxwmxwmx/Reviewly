# PRism Analysis Engine (C++)

核心分析引擎：diff 解析、分块、规则扫描、依赖图、评分聚合。对外通过 gRPC（`packages/contracts/proto/prism/v1/engine.proto`）暴露。

## 构建（默认，无 gRPC）

```bash
cd services/engine
cmake -B build
cmake --build build
./build/prism_engine
./build/prism_diff_test
```

## 构建（含 gRPC，Windows 推荐 vcpkg）

```bash
vcpkg install grpc protobuf
cmake -B build -DPRISM_USE_GRPC=ON -DCMAKE_TOOLCHAIN_FILE=[vcpkg]/scripts/buildsystems/vcpkg.cmake
cmake --build build
```

## 与 Gateway 协作

- 开发默认：`PRISM_STUB_ENGINE=1`，Python `StubEngineClient` 模拟 `RunAnalysis`。
- 生产：启动 `prism_engine` gRPC 服务，设置 `ENGINE_GRPC_ADDR=localhost:50051`，`PRISM_STUB_ENGINE=0`。
