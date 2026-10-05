cmake_minimum_required(VERSION 3.20)

project(Mashangzhixin LANGUAGES CXX)

add_executable(hello hello.cpp)

target_compile_features(hello PRIVATE cxx_std_17)

if(MSVC)
    target_compile_options(hello PRIVATE /utf-8)
endif()

add_executable(mashang_server backend/main.cpp)

target_compile_features(mashang_server PRIVATE cxx_std_17)
target_include_directories(mashang_server PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/third_party/cpp-httplib"
)

if(MSVC)
    target_compile_options(mashang_server PRIVATE /utf-8)
endif()

if(WIN32)
    target_link_libraries(mashang_server PRIVATE ws2_32)
endif()
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)