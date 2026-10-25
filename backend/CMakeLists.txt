cmake_minimum_required(VERSION 3.15)
project(RealTimeServer LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_subdirectory(crow/Crow-1.3.5)

find_package(CURL REQUIRED)

add_executable(server 
    src/main.cpp
    src/persona.cpp
    src/persona_store.cpp
    src/scenario.cpp
    src/scenario_store.cpp
    )
target_link_libraries(server PRIVATE Crow::Crow CURL::libcurl)

if(WIN32)
    target_link_libraries(server PRIVATE ws2_32 mswsock)
endif()
