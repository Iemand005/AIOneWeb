cmake_minimum_required(VERSION 3.20)
project(AIOneJS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(AIONE_WEB_PTHREADS "Build the Emscripten web target with pthreads multithreading" OFF)
option(AIONE_WEB_TTS "Build the Emscripten web target with text-to-speech support" ON)
set(AIONE_WEB_PTHREAD_POOL_SIZE 8 CACHE STRING "Number of pthread workers to preallocate")

if(AIONE_WEB_TTS)
    set(AIONE_ENABLE_TTS ON CACHE BOOL "Enable text-to-speech support (builds libmtmd)" FORCE)
endif()

if(EMSCRIPTEN)
    add_compile_options(-m64)
    add_link_options(-m64)
    # add_compile_options(--use-port=emdawnwebgpu)
    # add_link_options(--use-port=emdawnwebgpu)

    if(AIONE_WEB_PTHREADS)
        add_compile_options(-pthread)
        add_link_options(-pthread)
        add_compile_definitions(_REENTRANT)
    endif()
endif()

add_subdirectory(
    "../AIOne"
    "${CMAKE_CURRENT_BINARY_DIR}/AIOne"
)
        
if(EMSCRIPTEN)

    if(AIONE_WEB_PTHREADS)
        set(AIONE_WEB_TARGET AIOneWebMT)
    else()
        set(AIONE_WEB_TARGET AIOneWeb)
    endif()

    add_executable(${AIONE_WEB_TARGET}
        bindings/web/Main.cpp
    )

    target_include_directories(${AIONE_WEB_TARGET} PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}/../AIOne/include"
    )

    target_link_options(${AIONE_WEB_TARGET} PRIVATE
        --bind
        -sMODULARIZE=1
        -sENVIRONMENT=worker
        -sFORCE_FILESYSTEM=1
        -lworkerfs.js
        -sALLOW_MEMORY_GROWTH=1
        -sMAXIMUM_MEMORY=4GB
        -g
        -sASSERTIONS=2
        -fexceptions
        -sINITIAL_MEMORY=32MB
        -sSTACK_SIZE=16MB
        --pre-js "${CMAKE_CURRENT_SOURCE_DIR}/workerfs-bridge.js"
    )

    if(AIONE_WEB_PTHREADS)
        target_link_options(${AIONE_WEB_TARGET} PRIVATE
            -sPTHREAD_POOL_SIZE=${AIONE_WEB_PTHREAD_POOL_SIZE}
            -sDEFAULT_PTHREAD_STACK_SIZE=16MB
        )
    endif()

    target_link_libraries(${AIONE_WEB_TARGET} PRIVATE AIOneCore)

    set_target_properties(${AIONE_WEB_TARGET} PROPERTIES
        SUFFIX ".html"
    )
endif()
