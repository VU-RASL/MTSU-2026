cmake_minimum_required(VERSION 3.15)
project(RealTimeServer LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_subdirectory(crow/Crow-1.3.5)

add_executable(server 
    src/main.cpp
    src/persona.cpp
    src/persona_store.cpp
    )
target_link_libraries(server PRIVATE Crow::Crow)