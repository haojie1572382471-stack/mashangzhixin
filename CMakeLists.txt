cmake_minimum_required(VERSION 3.20)

project(Mashangzhixin LANGUAGES CXX)

add_executable(hello hello.cpp)

target_compile_features(hello PRIVATE cxx_std_17)

if(MSVC)
    target_compile_options(hello PRIVATE /utf-8)
endif()