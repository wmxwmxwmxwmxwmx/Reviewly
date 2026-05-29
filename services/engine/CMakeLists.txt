cmake_minimum_required(VERSION 3.20)
project(prism_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(PRISM_USE_GRPC "Build gRPC server (requires gRPC/protobuf)" OFF)

add_library(prism_diff src/diff/parser.cpp)
target_include_directories(prism_diff PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)

add_library(prism_scoring src/scoring/scoring.cpp)
target_include_directories(prism_scoring PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)

add_executable(prism_engine
  src/server/main.cpp
  src/chunking/chunking.cpp
  src/rules/rules.cpp
  src/graph/graph.cpp
)
target_link_libraries(prism_engine PRIVATE prism_diff prism_scoring)
target_include_directories(prism_engine PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)

if(PRISM_USE_GRPC)
  find_package(Protobuf CONFIG REQUIRED)
  find_package(gRPC CONFIG REQUIRED)
  set(PROTO_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../../packages/contracts/proto")
  set(PROTO_FILE "${PROTO_PATH}/prism/v1/engine.proto")
  set(GENERATED_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
  file(MAKE_DIRECTORY ${GENERATED_DIR})

  set(PROTO_SRCS "${GENERATED_DIR}/prism/v1/engine.pb.cc")
  set(PROTO_HDRS "${GENERATED_DIR}/prism/v1/engine.pb.h")
  set(GRPC_SRCS "${GENERATED_DIR}/prism/v1/engine.grpc.pb.cc")
  set(GRPC_HDRS "${GENERATED_DIR}/prism/v1/engine.grpc.pb.h")

  add_custom_command(
    OUTPUT ${PROTO_SRCS} ${PROTO_HDRS} ${GRPC_SRCS} ${GRPC_HDRS}
    COMMAND protobuf::protoc
    ARGS --proto_path=${PROTO_PATH}
         --cpp_out=${GENERATED_DIR}
         --grpc_out=${GENERATED_DIR}
         --plugin=protoc-gen-grpc=$<TARGET_FILE:gRPC::grpc_cpp_plugin>
         ${PROTO_FILE}
    DEPENDS ${PROTO_FILE}
    COMMENT "Generating engine gRPC sources"
  )

  target_sources(prism_engine PRIVATE ${PROTO_SRCS} ${GRPC_SRCS} src/server/grpc_service.cpp)
  target_link_libraries(prism_engine PRIVATE gRPC::grpc++ protobuf::libprotobuf)
  target_compile_definitions(prism_engine PRIVATE PRISM_USE_GRPC=1)
  target_include_directories(prism_engine PRIVATE ${GENERATED_DIR})
endif()

enable_testing()
add_executable(prism_diff_test tests/diff_parser_test.cpp)
target_link_libraries(prism_diff_test PRIVATE prism_diff)
add_test(NAME diff_parser COMMAND prism_diff_test)
